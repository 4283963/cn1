package com.boiler.repository;

import com.boiler.entity.SensorNode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SensorNodeRepository extends JpaRepository<SensorNode, Long> {
    Optional<SensorNode> findByNodeId(String nodeId);
    List<SensorNode> findByNodeType(String nodeType);
    List<SensorNode> findAllByOrderByPipeIndexAscIdAsc();
}
