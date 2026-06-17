package com.boiler.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "sensor_nodes")
public class SensorNode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "node_id", unique = true, nullable = false, length = 50)
    private String nodeId;

    @Column(name = "node_name", nullable = false, length = 100)
    private String nodeName;

    @Column(name = "node_type", nullable = false, length = 30)
    private String nodeType;

    @Column(name = "position_x")
    private Double positionX;

    @Column(name = "position_y")
    private Double positionY;

    @Column(name = "position_z")
    private Double positionZ;

    @Column(name = "pipe_index")
    private Integer pipeIndex;

    @Column(name = "temperature")
    private Double temperature;

    @Column(name = "pressure")
    private Double pressure;

    @Column(name = "status", length = 20)
    private String status = "NORMAL";

    @Column(name = "last_updated")
    private LocalDateTime lastUpdated;

    public SensorNode() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

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
