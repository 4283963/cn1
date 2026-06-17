package com.boiler.dto;

import java.time.LocalDateTime;

public class SensorNodeDTO {
    private String nodeId;
    private String nodeName;
    private String nodeType;
    private Double positionX;
    private Double positionY;
    private Double positionZ;
    private Integer pipeIndex;
    private Double temperature;
    private Double pressure;
    private String status;
    private LocalDateTime lastUpdated;

    public SensorNodeDTO() {
    }

    private SensorNodeDTO(Builder b) {
        this.nodeId = b.nodeId;
        this.nodeName = b.nodeName;
        this.nodeType = b.nodeType;
        this.positionX = b.positionX;
        this.positionY = b.positionY;
        this.positionZ = b.positionZ;
        this.pipeIndex = b.pipeIndex;
        this.temperature = b.temperature;
        this.pressure = b.pressure;
        this.status = b.status;
        this.lastUpdated = b.lastUpdated;
    }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private String nodeId;
        private String nodeName;
        private String nodeType;
        private Double positionX;
        private Double positionY;
        private Double positionZ;
        private Integer pipeIndex;
        private Double temperature;
        private Double pressure;
        private String status;
        private LocalDateTime lastUpdated;

        public Builder nodeId(String v) { this.nodeId = v; return this; }
        public Builder nodeName(String v) { this.nodeName = v; return this; }
        public Builder nodeType(String v) { this.nodeType = v; return this; }
        public Builder positionX(Double v) { this.positionX = v; return this; }
        public Builder positionY(Double v) { this.positionY = v; return this; }
        public Builder positionZ(Double v) { this.positionZ = v; return this; }
        public Builder pipeIndex(Integer v) { this.pipeIndex = v; return this; }
        public Builder temperature(Double v) { this.temperature = v; return this; }
        public Builder pressure(Double v) { this.pressure = v; return this; }
        public Builder status(String v) { this.status = v; return this; }
        public Builder lastUpdated(LocalDateTime v) { this.lastUpdated = v; return this; }
        public SensorNodeDTO build() { return new SensorNodeDTO(this); }
    }

    public String getNodeId() { return nodeId; }
    public void setNodeId(String nodeId) { this.nodeId = nodeId; }

    public String getNodeName() { return nodeName; }
    public void setNodeName(String nodeName) { this.nodeName = nodeName; }

    public String getNodeType() { return nodeType; }
    public void setNodeType(String nodeType) { this.nodeType = nodeType; }

    public Double getPositionX() { return positionX; }
    public void setPositionX(Double positionX) { this.positionX = positionX; }

    public Double getPositionY() { return positionY; }
    public void setPositionY(Double positionY) { this.positionY = positionY; }

    public Double getPositionZ() { return positionZ; }
    public void setPositionZ(Double positionZ) { this.positionZ = positionZ; }

    public Integer getPipeIndex() { return pipeIndex; }
    public void setPipeIndex(Integer pipeIndex) { this.pipeIndex = pipeIndex; }

    public Double getTemperature() { return temperature; }
    public void setTemperature(Double temperature) { this.temperature = temperature; }

    public Double getPressure() { return pressure; }
    public void setPressure(Double pressure) { this.pressure = pressure; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getLastUpdated() { return lastUpdated; }
    public void setLastUpdated(LocalDateTime lastUpdated) { this.lastUpdated = lastUpdated; }
}
