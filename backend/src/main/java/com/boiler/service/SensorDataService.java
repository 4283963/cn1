package com.boiler.service;

import com.boiler.dto.SensorNodeDTO;
import com.boiler.entity.SensorNode;
import com.boiler.repository.SensorNodeRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

@Service
public class SensorDataService {

    private static final Logger log = LoggerFactory.getLogger(SensorDataService.class);

    private final SensorNodeRepository sensorNodeRepository;

    private final Map<String, SensorNode> nodeStore = new ConcurrentHashMap<>();
    private final AtomicReference<CachedSnapshot> snapshot = new AtomicReference<>();

    private final java.util.Random random = new java.util.Random();

    @Value("${app.temperature.min}")
    private double tempMin;

    @Value("${app.temperature.max}")
    private double tempMax;

    @Value("${app.pressure.min}")
    private double pressureMin;

    @Value("${app.pressure.max}")
    private double pressureMax;

    @Value("${app.cache-ttl-ms:800}")
    private long cacheTtlMs;

    public SensorDataService(SensorNodeRepository sensorNodeRepository) {
        this.sensorNodeRepository = sensorNodeRepository;
    }

    @PostConstruct
    public void init() {
        List<SensorNode> initial = sensorNodeRepository.findAllOrdered();
        initial.forEach(n -> nodeStore.put(n.getNodeId(), n));
        rebuildSnapshot();
        log.info("Loaded {} sensor nodes into memory cache", nodeStore.size());
    }

    public List<SensorNodeDTO> getAllSensorData() {
        CachedSnapshot snap = snapshot.get();
        if (snap != null && !snap.isExpired(cacheTtlMs)) {
            return snap.dtoList;
        }
        rebuildSnapshot();
        return snapshot.get().dtoList;
    }

    public SensorNodeDTO getSensorDataByNodeId(String nodeId) {
        SensorNode node = nodeStore.get(nodeId);
        if (node == null) {
            throw new RuntimeException("Sensor node not found: " + nodeId);
        }
        return convertToDTO(node);
    }

    @Scheduled(fixedDelayString = "${app.data-update-interval}")
    public void updateSensorDataSimulated() {
        if (nodeStore.isEmpty()) return;

        LocalDateTime now = LocalDateTime.now();
        List<SensorNode> updates = new ArrayList<>(nodeStore.size());

        for (SensorNode node : nodeStore.values()) {
            double baseTemp = node.getTemperature() != null ? node.getTemperature() : (tempMin + tempMax) / 2;
            double tempDelta = (random.nextDouble() - 0.5) * 12;
            double newTemp = Math.max(tempMin, Math.min(tempMax, baseTemp + tempDelta));

            double basePressure = node.getPressure() != null ? node.getPressure() : (pressureMin + pressureMax) / 2;
            double pressureDelta = (random.nextDouble() - 0.5) * 0.3;
            double newPressure = Math.max(pressureMin, Math.min(pressureMax, basePressure + pressureDelta));

            double roundedTemp = Math.round(newTemp * 100.0) / 100.0;
            double roundedPressure = Math.round(newPressure * 100.0) / 100.0;

            String status = "NORMAL";
            if (newTemp > tempMax * 0.9 || newPressure > pressureMax * 0.9) {
                status = "WARNING";
            }
            if (newTemp > tempMax * 0.95 || newPressure > pressureMax * 0.95) {
                status = "ALARM";
            }

            node.setTemperature(roundedTemp);
            node.setPressure(roundedPressure);
            node.setStatus(status);
            node.setLastUpdated(now);
            updates.add(node);
        }

        try {
            persistBulk(updates, now);
        } catch (Exception e) {
            log.warn("Bulk persist failed ({}), memory state still valid: {}", e.getClass().getSimpleName(), e.getMessage());
        }

        rebuildSnapshot();
        if (log.isDebugEnabled()) {
            log.debug("Updated {} nodes in memory + DB", updates.size());
        }
    }

    private void persistBulk(List<SensorNode> nodes, LocalDateTime now) {
        for (SensorNode n : nodes) {
            sensorNodeRepository.updateSensorValues(
                    n.getNodeId(), n.getTemperature(), n.getPressure(), n.getStatus(), now);
        }
    }

    private void rebuildSnapshot() {
        List<SensorNodeDTO> list = nodeStore.values().stream()
                .sorted((a, b) -> {
                    Integer pa = a.getPipeIndex();
                    Integer pb = b.getPipeIndex();
                    if (pa == null && pb == null) return Long.compare(a.getId() == null ? 0 : a.getId(), b.getId() == null ? 0 : b.getId());
                    if (pa == null) return 1;
                    if (pb == null) return -1;
                    int c = Integer.compare(pa, pb);
                    if (c != 0) return c;
                    return Long.compare(a.getId() == null ? 0 : a.getId(), b.getId() == null ? 0 : b.getId());
                })
                .map(this::convertToDTO)
                .collect(Collectors.toList());
        snapshot.set(new CachedSnapshot(list, System.currentTimeMillis()));
    }

    private SensorNodeDTO convertToDTO(SensorNode entity) {
        return SensorNodeDTO.builder()
                .nodeId(entity.getNodeId())
                .nodeName(entity.getNodeName())
                .nodeType(entity.getNodeType())
                .positionX(entity.getPositionX())
                .positionY(entity.getPositionY())
                .positionZ(entity.getPositionZ())
                .pipeIndex(entity.getPipeIndex())
                .temperature(entity.getTemperature())
                .pressure(entity.getPressure())
                .status(entity.getStatus())
                .lastUpdated(entity.getLastUpdated())
                .build();
    }

    private static final class CachedSnapshot {
        final List<SensorNodeDTO> dtoList;
        final long createdAt;

        CachedSnapshot(List<SensorNodeDTO> dtoList, long createdAt) {
            this.dtoList = List.copyOf(dtoList);
            this.createdAt = createdAt;
        }

        boolean isExpired(long ttlMs) {
            return (System.currentTimeMillis() - createdAt) > ttlMs;
        }
    }
}
