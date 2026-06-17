# 锅炉房三维状态监控系统

基于 Three.js + Spring Boot + PostgreSQL 的锅炉房 3D 可视化监控系统。

## 系统架构

```
┌─────────────────┐    定时轮询 (HTTP)    ┌──────────────────┐     JPA      ┌──────────────┐
│  前端 (Three.js) │ ◄────────────────────►│ Spring Boot 后端 │ ◄───────────►│  PostgreSQL  │
│  Vite + Three.js │   /api/v1/sensors     │  (端口 8080)     │              │  (可选，默认H2)│
└─────────────────┘                       └──────────────────┘              └──────────────┘
       │                                          │
       ▼                                          ▼
  3D 渲染 + 热力颜色                        定时更新模拟数据
  (蓝色=冷 ~ 红色=热)                      (每 2 秒随机波动)
```

## 目录结构

```
cn1/
├── backend/                    # Spring Boot 后端
│   ├── pom.xml
│   └── src/main/
│       ├── java/com/boiler/
│       │   ├── BoilerMonitorApplication.java
│       │   ├── config/CorsConfig.java
│       │   ├── controller/SensorDataController.java
│       │   ├── dto/SensorNodeDTO.java
│       │   ├── entity/SensorNode.java
│       │   ├── repository/SensorNodeRepository.java
│       │   └── service/SensorDataService.java
│       └── resources/
│           ├── application.yml
│           ├── schema.sql
│           └── data.sql
└── frontend/                   # Three.js 前端
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.js
        ├── styles.css
        ├── api/client.js
        ├── utils/heatColor.js
        └── three/SceneManager.js
```

## 快速启动

### 1. 启动后端 (Spring Boot)

#### 方式一：使用内置 H2 数据库（推荐，零配置）

```bash
cd backend
./mvnw spring-boot:run
```

或使用 Maven 全局安装：
```bash
cd backend
mvn spring-boot:run
```

后端启动后：
- API 地址：`http://localhost:8080/api/v1/sensors`
- 健康检查：`http://localhost:8080/api/v1/sensors/health`
- H2 控制台：`http://localhost:8080/api/h2-console`（JDBC URL: `jdbc:h2:mem:boiler_db`）

#### 方式二：使用 PostgreSQL

修改 `backend/src/main/resources/application.yml`：

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/boiler_db
    username: postgres
    password: your_password
    driver-class-name: org.postgresql.Driver
  jpa:
    database-platform: org.hibernate.dialect.PostgreSQLDialect
```

创建数据库：
```sql
CREATE DATABASE boiler_db;
```

### 2. 启动前端 (Vite + Three.js)

```bash
cd frontend
npm install
npm run dev
```

前端启动后自动打开：`http://localhost:3000`

## 功能说明

### 后端功能

| 功能 | 接口 | 说明 |
|------|------|------|
| 获取全部传感器 | `GET /api/v1/sensors` | 返回所有节点的实时温度、压力、状态 |
| 获取单个节点 | `GET /api/v1/sensors/{nodeId}` | 指定节点详情 |
| 健康检查 | `GET /api/v1/sensors/health` | 服务状态 |
| 定时数据更新 | `@Scheduled` | 每 2 秒自动模拟数据波动 |

### 前端功能

1. **3D 场景渲染**
   - 2 台锅炉模型（带观察窗、烟囱、法兰环、发光效果）
   - 10 段管道（含法兰、螺栓、流动光环）
   - 4 个阀门（带手柄、阀杆）
   - 地面网格 + 阴影 + 雾效

2. **热力颜色映射**
   - 温度范围：40°C（蓝）~ 180°C（红）
   - 颜色梯度：蓝 → 青 → 绿 → 黄 → 橙 → 红
   - 管道网格根据绑定节点温度实时变色

3. **数据轮询**
   - 默认每 2 秒请求后端接口
   - 可在控制面板调整轮询间隔（500ms ~ 10000ms）
   - 支持暂停/继续更新

4. **交互功能**
   - 鼠标悬停：显示节点 Tooltip（温度/压力/状态）
   - 点击侧栏传感器：相机动画飞行至该节点
   - 鼠标拖拽旋转、滚轮缩放、右键平移
   - 自动旋转视角开关

5. **报警系统**
   - 温度 > 162°C 或压力 > 2.7 MPa → 预警（黄色）
   - 温度 > 171°C 或压力 > 2.85 MPa → 报警（红色闪烁）

## 传感器节点说明

data.sql 初始配置了 21 个节点：

| 类型 | 数量 | 说明 |
|------|------|------|
| BOILER | 2 | 1号、2号锅炉主体 |
| PIPE | 13 | 主给水、主蒸汽、回水等管道节点 |
| VALVE | 4 | 主给水阀、蒸汽阀、回水阀 |

每个节点包含：
- `nodeId`：唯一标识
- `positionX/Y/Z`：3D 坐标
- `pipeIndex`：所属管道编号（用于同管道多节点温度平均）
- `temperature`：温度（°C）
- `pressure`：压力（MPa）
- `status`：状态（NORMAL / WARNING / ALARM）

## 生产部署建议

1. **数据库切换**：将 H2 换成 PostgreSQL，修改 `application.yml` 的 datasource 配置
2. **真实数据接入**：替换 `SensorDataService.updateSensorDataSimulated()` 为真实 PLC/Modbus 读取逻辑
3. **前端构建**：`cd frontend && npm run build`，将 dist 目录作为静态资源由后端或 Nginx 托管
4. **HTTPS & 认证**：生产环境启用 HTTPS，并在 `/api/**` 添加 JWT/OAuth2 认证
5. **WebSocket 替代轮询**：实时性要求高时，将 HTTP 轮询换成 WebSocket（STOMP over SockJS）
