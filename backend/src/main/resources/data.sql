INSERT INTO sensor_nodes (node_id, node_name, node_type, position_x, position_y, position_z, pipe_index, temperature, pressure, status, last_updated) VALUES
('BOILER_01', '1号锅炉主体', 'BOILER', 0, 2, 0, NULL, 150.5, 2.5, 'NORMAL', CURRENT_TIMESTAMP()),
('BOILER_02', '2号锅炉主体', 'BOILER', 8, 2, 0, NULL, 145.2, 2.3, 'NORMAL', CURRENT_TIMESTAMP()),

('PIPE_01_01', '主给水管道入口', 'PIPE', -6, 2, 0, 1, 65.0, 1.2, 'NORMAL', CURRENT_TIMESTAMP()),
('PIPE_01_02', '主给水管道中间', 'PIPE', -3, 2, 0, 1, 85.0, 1.4, 'NORMAL', CURRENT_TIMESTAMP()),
('PIPE_01_03', '主给水管道出口', 'PIPE', -0.5, 2, 0, 1, 110.0, 1.8, 'NORMAL', CURRENT_TIMESTAMP()),

('PIPE_02_01', '1号炉主蒸汽管道入口', 'PIPE', 0.5, 4.5, 0, 2, 165.0, 2.8, 'NORMAL', CURRENT_TIMESTAMP()),
('PIPE_02_02', '1号炉主蒸汽管道中间', 'PIPE', 2.5, 4.5, 0, 2, 160.0, 2.7, 'NORMAL', CURRENT_TIMESTAMP()),
('PIPE_02_03', '1号炉主蒸汽管道出口', 'PIPE', 4.5, 4.5, 0, 2, 155.0, 2.6, 'NORMAL', CURRENT_TIMESTAMP()),

('PIPE_03_01', '2号炉主蒸汽管道入口', 'PIPE', 7.5, 4.5, 0, 3, 162.0, 2.7, 'NORMAL', CURRENT_TIMESTAMP()),
('PIPE_03_02', '2号炉主蒸汽管道中间', 'PIPE', 9.5, 4.5, 0, 3, 158.0, 2.6, 'NORMAL', CURRENT_TIMESTAMP()),
('PIPE_03_03', '2号炉主蒸汽管道出口', 'PIPE', 11.5, 4.5, 0, 3, 154.0, 2.5, 'NORMAL', CURRENT_TIMESTAMP()),

('PIPE_04_01', '回水管道起点', 'PIPE', 12, 1, 0, 4, 45.0, 0.8, 'NORMAL', CURRENT_TIMESTAMP()),
('PIPE_04_02', '回水管道中间1', 'PIPE', 8, 1, 0, 4, 50.0, 0.9, 'NORMAL', CURRENT_TIMESTAMP()),
('PIPE_04_03', '回水管道中间2', 'PIPE', 4, 1, 0, 4, 55.0, 1.0, 'NORMAL', CURRENT_TIMESTAMP()),
('PIPE_04_04', '回水管道终点', 'PIPE', -6, 1, 0, 4, 60.0, 1.1, 'NORMAL', CURRENT_TIMESTAMP()),

('PIPE_05_01', '1号炉连接管上段', 'PIPE', 0, 3.25, 0, 5, 158.0, 2.6, 'NORMAL', CURRENT_TIMESTAMP()),
('PIPE_05_02', '2号炉连接管上段', 'PIPE', 8, 3.25, 0, 6, 155.0, 2.5, 'NORMAL', CURRENT_TIMESTAMP()),

('VALVE_01', '主给水阀', 'VALVE', -4.5, 2, 0, 1, 75.0, 1.3, 'NORMAL', CURRENT_TIMESTAMP()),
('VALVE_02', '1号炉蒸汽阀', 'VALVE', 3.5, 4.5, 0, 2, 158.0, 2.65, 'NORMAL', CURRENT_TIMESTAMP()),
('VALVE_03', '2号炉蒸汽阀', 'VALVE', 10.5, 4.5, 0, 3, 156.0, 2.55, 'NORMAL', CURRENT_TIMESTAMP()),
('VALVE_04', '回水总阀', 'VALVE', 10, 1, 0, 4, 48.0, 0.85, 'NORMAL', CURRENT_TIMESTAMP());
