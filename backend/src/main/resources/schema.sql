CREATE TABLE IF NOT EXISTS sensor_nodes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    node_id VARCHAR(50) NOT NULL UNIQUE,
    node_name VARCHAR(100) NOT NULL,
    node_type VARCHAR(30) NOT NULL,
    position_x DOUBLE,
    position_y DOUBLE,
    position_z DOUBLE,
    pipe_index INT,
    temperature DOUBLE,
    pressure DOUBLE,
    status VARCHAR(20) DEFAULT 'NORMAL',
    last_updated TIMESTAMP
);
