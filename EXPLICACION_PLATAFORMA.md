# Plataforma M.Y.C.O - Sistema de Simulación de Remediación en Marte

## 🎯 ¿Qué hace la plataforma?

**M.Y.C.O** es una plataforma de simulación para la gestión de misiones de remediación ambiental en Marte. El sistema permite:

- **Gestión de Robots**: Controlar flotas de robots sembradores autónomos que operan en el planeta Marte
- **Planificación de Rutas**: Calcular rutas óptimas para que los robots naveguen entre puntos de interés utilizando algoritmos de pathfinding
- **IA de Remediación**: Sistema inteligente que detecta zonas tóxicas y asigna automáticamente rutas a los robots disponibles para su limpieza
- **Monitoreo en Tiempo Real**: Visualización del estado de los robots, sus ubicaciones, niveles de batería y sensores
- **Simulación de Gemelo Digital**: Panel de estadísticas que simula el comportamiento de la misión
- **Gestión de Biopolímeros**: Monitoreo del crecimiento de organismos biológicos sembrados en Marte

## 🏗️ Arquitectura del Sistema

La plataforma sigue una arquitectura **cliente-servidor** separada en dos componentes principales:

### Backend (API REST)
- **Framework**: Laravel 12.0 (PHP 8.2+)
- **Base de Datos**: Eloquent ORM (soporta MySQL, PostgreSQL, SQLite)
- **Patrón**: MVC con servicios para lógica de negocio

### Frontend (Aplicación Web)
- **Framework**: React 19.2.5
- **Build Tool**: Vite 8.0.10
- **Estilos**: TailwindCSS 4.2.4
- **Mapas**: Leaflet 1.9.4 + React-Leaflet 5.0.0

## 🛠️ Tecnologías Utilizadas

### Backend (Laravel)
- **Laravel Framework 12.0**: Framework PHP para el desarrollo de APIs REST
- **PHP 8.2+**: Lenguaje de programación del lado del servidor
- **Eloquent ORM**: Mapeo objeto-relacional para la base de datos
- **Laravel Tinker**: Consola interactiva para pruebas
- **Queue System**: Para procesamiento de tareas en segundo plano
- **Event Broadcasting**: Para actualizaciones en tiempo real

### Frontend (React + Vite)
- **React 19.2.5**: Biblioteca JavaScript para construir interfaces de usuario
- **Vite 8.0.10**: Herramienta de build ultra-rápeta
- **TailwindCSS 4.2.4**: Framework CSS para estilos utility-first
- **Leaflet 1.9.4**: Biblioteca para mapas interactivos
- **React-Leaflet 5.0.0**: Integración de Leaflet con React
- **ESLint**: Herramienta de linting para código JavaScript

## 📊 Modelo de Datos

La plataforma gestiona las siguientes entidades principales:

### Robot
- **nombre**: Identificador del robot
- **estado**: Estado actual (disponible, en_ruta, mantenimiento)
- **latitud_marte / longitud_marte**: Ubicación en coordenadas marcianas
- **bateria**: Nivel de carga (0-100%)
- **sensores_ir**: Array de datos de sensores infrarrojos

### Ruta
- **robot_id**: Robot asignado a la ruta
- **puntos**: Array de coordenadas para el pathfinding
- **estado**: Estado de la ruta (planificada, en_progreso, completada)
- **inicio / fin**: Timestamps de la misión

### ZonaToxica
- **latitud / longitud**: Centro de la zona contaminada
- **radio**: Área de afectación
- **nivel_toxicidad**: Grado de contaminación
- **activa**: Estado de la zona

### Biopolimero
- **ubicacion**: Coordenadas de siembra
- **tipo**: Tipo de organismo
- **estado_crecimiento**: Fase de desarrollo
- **fecha_siembra**: Timestamp de plantación

## 🔧 Funcionalidades Principales

### 1. Gestión de Robots
- CRUD completo para robots
- Monitoreo de ubicación en tiempo real
- Seguimiento de niveles de batería
- Visualización de datos de sensores

### 2. Pathfinding y Rutas
- **Algoritmo A***: Para encontrar rutas óptimas
- **Cobertura Zig-Zag**: Patrón de cobertura para limpieza de áreas
- **Interpolación Lineal**: Generación de puntos intermedios
- Generación manual de rutas
- Asignación automática de rutas por IA

### 3. IA de Remediación
- Detección automática de zonas tóxicas
- Asignación inteligente de robots a zonas contaminadas
- Priorización basada en nivel de toxicidad
- Optimización de recursos disponibles

### 4. Visualización en Mapas
- Mapas interactivos de Marte
- Visualización de ubicaciones de robots
- Representación de rutas planificadas
- Marcadores de zonas tóxicas
- Múltiples mapas disponibles

### 5. Estadísticas y Monitoreo
- Panel de KPIs en tiempo real
- Estadísticas por ruta específica
- Estado global de la misión
- Simulación de gemelo digital

## 🚀 Endpoints de la API

### Robots
- `GET /api/robots` - Listar todos los robots
- `POST /api/robots` - Crear nuevo robot
- `GET /api/robots/{id}` - Obtener detalle de robot
- `PUT /api/robots/{id}` - Actualizar robot
- `DELETE /api/robots/{id}` - Eliminar robot
- `GET /api/robots/{robot}/ubicacion` - Ubicación actual

### Rutas
- `GET /api/rutas` - Listar rutas
- `POST /api/rutas/generate` - Generar nueva ruta
- `GET /api/rutas/{id}` - Detalle de ruta
- `POST /api/rutas/{ruta}/iniciar` - Iniciar ruta
- `POST /api/rutas/{ruta}/completar` - Completar ruta
- `GET /api/rutas/robot/{robot}` - Rutas por robot

### IA y Zonas Tóxicas
- `GET /api/zonas-toxicas` - Listar zonas contaminadas
- `POST /api/ia/remediar` - Activar IA de remediación

### Biopolímeros
- `GET /api/biopolimeros` - Listar biopolímeros
- `GET /api/biopolimeros/area` - Por área geográfica
- `GET /api/biopolimeros/estadisticas` - Estadísticas de crecimiento
- `PUT /api/biopolimeros/{id}/actualizar-crecimiento` - Actualizar estado

### Sistema
- `GET /api/health` - Health check del servidor

## 🎨 Componentes del Frontend

### Dashboard
- Panel principal con navegación
- Integración de todos los módulos
- Control de IA de remediación
- Estado general del sistema

### MapaMarte
- Visualización interactiva del mapa
- Marcadores de robots y rutas
- Selección de mapas múltiples
- Animaciones de movimiento

### RobotList
- Listado de robots con estado
- Filtros y búsqueda
- Acciones rápidas
- Detalles de cada robot

### EstadisticasPanel
- KPIs en tiempo real
- Gráficos de simulación
- Métricas por ruta
- Estado de gemelo digital

### Modales
- **GenerateRutaModal**: Creación manual de rutas
- **CreateRobotModal**: Registro de nuevos robots

## 🔄 Flujo de Trabajo Típico

1. **Registro de Robots**: Se agregan robots a la flota con sus capacidades
2. **Detección de Zonas**: El sistema identifica zonas tóxicas en Marte
3. **Activación de IA**: Se activa la IA de remediación
4. **Asignación de Rutas**: La IA asigna rutas óptimas a los robots disponibles
5. **Ejecución**: Los robots navegan las rutas y realizan la limpieza
6. **Monitoreo**: Se visualiza el progreso en tiempo real
7. **Completación**: Se registran las rutas completadas y se actualizan estadísticas

## 📦 Estructura del Proyecto

```
reto-marte/
├── backend/
│   └── mars/                 # Laravel Backend
│       ├── app/
│       │   ├── Http/Controllers/  # Controladores API
│       │   ├── Models/            # Modelos Eloquent
│       │   └── Services/          # Lógica de negocio (Pathfinding)
│       ├── routes/            # Definición de rutas API
│       ├── config/            # Configuración Laravel
│       └── database/          # Migraciones y seeders
├── fronted/
│   └── mars/                 # React Frontend
│       ├── src/
│       │   ├── components/    # Componentes React
│       │   ├── services/      # Servicios API
│       │   └── assets/        # Recursos estáticos
│       └── package.json       # Dependencias Node
└── src/                      # Recursos compartidos
```

## 🎯 Objetivo del Proyecto

La plataforma simula un escenario futurista donde la humanidad coloniza Marte y necesita gestionar la remediación ambiental mediante robots autónomos y biopolímeros. El sistema demuestra capacidades de:

- **Planificación de rutas** con algoritmos de búsqueda
- **Gestión de flotas** de robots autónomos
- **Toma de decisiones** mediante IA
- **Visualización geoespacial** en mapas interactivos
- **Monitoreo en tiempo real** de misiones complejas

---

**Versión**: v1.1.0  
**Estado**: Activo y Online  
**Algoritmo Principal**: A* + Cobertura Zig-Zag
