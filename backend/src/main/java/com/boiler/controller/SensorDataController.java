package com.boiler.controller;

import com.boiler.dto.SensorNodeDTO;
import com.boiler.service.SensorDataService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/v1/sensors")
public class SensorDataController {

    private final SensorDataService sensorDataService;

    public SensorDataController(SensorDataService sensorDataService) {
        this.sensorDataService = sensorDataService;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getAllSensors() {
        List<SensorNodeDTO> data = sensorDataService.getAllSensorData();
        Map<String, Object> response = new HashMap<>();
        response.put("code", 200);
        response.put("message", "success");
        response.put("timestamp", System.currentTimeMillis());
        response.put("data", data);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{nodeId}")
    public ResponseEntity<Map<String, Object>> getSensorByNodeId(@PathVariable String nodeId) {
        SensorNodeDTO data = sensorDataService.getSensorDataByNodeId(nodeId);
        Map<String, Object> response = new HashMap<>();
        response.put("code", 200);
        response.put("message", "success");
        response.put("timestamp", System.currentTimeMillis());
        response.put("data", data);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        Map<String, Object> response = new HashMap<>();
        response.put("code", 200);
        response.put("status", "UP");
        response.put("service", "boiler-monitor");
        response.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.ok(response);
    }
}
