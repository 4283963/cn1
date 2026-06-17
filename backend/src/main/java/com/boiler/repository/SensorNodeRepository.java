package com.boiler.repository;

import com.boiler.entity.SensorNode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface SensorNodeRepository extends JpaRepository<SensorNode, Long> {
    Optional<SensorNode> findByNodeId(String nodeId);
    List<SensorNode> findByNodeType(String nodeType);

    @Query("SELECT s FROM SensorNode s ORDER BY s.pipeIndex ASC NULLS LAST, s.id ASC")
    List<SensorNode> findAllOrdered();

    @Modifying
    @Transactional
    @Query("UPDATE SensorNode s SET " +
           "s.temperature = :temperature, " +
           "s.pressure = :pressure, " +
           "s.status = :status, " +
           "s.lastUpdated = :lastUpdated " +
           "WHERE s.nodeId = :nodeId")
    int updateSensorValues(@Param("nodeId") String nodeId,
                           @Param("temperature") Double temperature,
                           @Param("pressure") Double pressure,
                           @Param("status") String status,
                           @Param("lastUpdated") LocalDateTime lastUpdated);
}
