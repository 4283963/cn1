package com.boiler.service;

import com.boiler.dto.SensorNodeDTO;
import com.boiler.entity.SensorNode;
import com.boiler.repository.SensorNodeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Random;
import java.util.stream.Collectors;

@Service
public class SensorDataService {

    private static final Logger log = LoggerFactory.getLogger(SensorDataService.class);

    private final SensorNodeRepository sensorNodeRepository;
    private final Random random = new Random();

    public SensorDataService(SensorNodeRepository sensorNodeRepository) {
        this.sensorNodeRepository = sensorNodeRepository;
    }

    @Value("${app.temperature.min}")
    private double tempMin;

    @Value("${app.temperature.max}")
    private double tempMax;

    @Value("${app.pressure.min}")
    private double pressureMin;

    @Value("${app.pressure.max}")
    private double pressureMax;

    @Transactional(readOnly = true)
    public List<SensorNodeDTO> getAllSensorData() {
        return sensorNodeRepository.findAllByOrderByPipeIndexAscIdAsc()
                .stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public SensorNodeDTO getSensorDataByNodeId(String nodeId) {
        return sensorNodeRepository.findByNodeId(nodeId)
                .map(this::convertToDTO)
                .orElseThrow(() -> new RuntimeException("Sensor node not found: " + nodeId));
    }

    @Scheduled(fixedDelayString = "${app.data-update-interval}")
    @Transactional
    public void updateSensorDataSimulated() {
        List<SensorNode> nodes = sensorNodeRepository.findAll();
        LocalDateTime now = LocalDateTime.now();

        for (SensorNode node : nodes) {
            double baseTemp = node.getTemperature() != null ? node.getTemperature() : (tempMin + tempMax) / 2;
            double tempDelta = (random.nextDouble() - 0.5) * 12;
            double newTemp = Math.max(tempMin, Math.min(tempMax, baseTemp + tempDelta));

            double basePressure = node.getPressure() != null ? node.getPressure() : (pressureMin + pressureMax) / 2;
            double pressureDelta = (random.nextDouble() - 0.5) * 0.3;
            double newPressure = Math.max(pressureMin, Math.min(pressureMax, basePressure + pressureDelta));

            node.setTemperature(Math.round(newTemp * 100.0) / 100.0);
            node.setPressure(Math.round(newPressure * 100.0) / 100.0);
            node.setLastUpdated(now);

            String status = "NORMAL";
            if (newTemp > tempMax * 0.9 || newPressure > pressureMax * 0.9) {
                status = "WARNING";
            }
            if (newTemp > tempMax * 0.95 || newPressure > pressureMax * 0.95) {
                status = "ALARM";
            }
            node.setStatus(status);
        }

        sensorNodeRepository.saveAll(nodes);
        log.debug("Updated {} sensor nodes at {}", nodes.size(), now);
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
}
