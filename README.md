# M.Y.C.O - Plataforma de Simulacion de Remediacion en Marte

## Descripcion del Proyecto

M.Y.C.O es una plataforma de simulacion para la gestion de misiones de remediacion ambiental en Marte. El sistema permite controlar flotas de robots autonomos, planificar rutas optimas utilizando algoritmos de pathfinding, y monitorear el estado de la mision en tiempo real.

La plataforma incluye una IA de remediacion que detecta zonas toxicas y asigna automaticamente rutas a los robots disponibles para su limpieza, asi como un sistema de gemelo digital para simular el comportamiento de la mision.

## Caracteristicas Principales

- Gestion completa de robots sembradores autonomos
- Planificacion de rutas con algoritmo A* y patron de cobertura zig-zag
- IA de remediacion para deteccion y asignacion automatica de zonas toxicas
- Monitoreo en tiempo real de ubicaciones, niveles de bateria y sensores
- Visualizacion interactiva en mapas de Marte con Leaflet
- Panel de estadisticas y simulacion de gemelo digital
- Gestion de biopolimeros y monitoreo de crecimiento
- API REST completa para todas las operaciones

## Arquitectura del Sistema

La plataforma sigue una arquitectura cliente-servidor separada en dos componentes principales:

### Backend (API REST)
- Framework: Laravel 12.0 (PHP 8.2+)
- Base de datos: Eloquent ORM (soporta MySQL, PostgreSQL, SQLite)
- Patron: MVC con servicios para logica de negocio

### Frontend (Aplicacion Web)
- Framework: React 19.2.5
- Build Tool: Vite 8.0.10
- Estilos: TailwindCSS 4.2.4
- Mapas: Leaflet 1.9.4 + React-Leaflet 5.0.0

## Tecnologias Utilizadas

### Backend
- Laravel Framework 12.0: Framework PHP para el desarrollo de APIs REST
- PHP 8.2+: Lenguaje de programacion del lado del servidor
- Eloquent ORM: Mapeo objeto-relacional para la base de datos
- Laravel Tinker: Consola interactiva para pruebas
- Queue System: Para procesamiento de tareas en segundo plano
- Event Broadcasting: Para actualizaciones en tiempo real

### Frontend
- React 19.2.5: Biblioteca JavaScript para construir interfaces de usuario
- Vite 8.0.10: Herramienta de build ultra-rapida
- TailwindCSS 4.2.4: Framework CSS para estilos utility-first
- Leaflet 1.9.4: Biblioteca para mapas interactivos
- React-Leaflet 5.0.0: Integracion de Leaflet con React
- ESLint: Herramienta de linting para codigo JavaScript

## Modelo de Datos

### Robot
- nombre: Identificador del robot
- estado: Estado actual (disponible, en_ruta, mantenimiento)
- latitud_marte / longitud_marte: Ubicacion en coordenadas marcianas
- bateria: Nivel de carga (0-100%)
- sensores_ir: Array de datos de sensores infrarrojos

### Ruta
- robot_id: Robot asignado a la ruta
- puntos: Array de coordenadas para el pathfinding
- estado: Estado de la ruta (planificada, en_progreso, completada)
- inicio / fin: Timestamps de la mision

### ZonaToxica
- latitud / longitud: Centro de la zona contaminada
- radio: Area de afectacion
- nivel_toxicidad: Grado de contaminacion
- activa: Estado de la zona

### Biopolimero
- ubicacion: Coordenadas de siembra
- tipo: Tipo de organismo
- estado_crecimiento: Fase de desarrollo
- fecha_siembra: Timestamp de plantacion

## Endpoints de la API

### Robots
- GET /api/robots - Listar todos los robots
- POST /api/robots - Crear nuevo robot
- GET /api/robots/{id} - Obtener detalle de robot
- PUT /api/robots/{id} - Actualizar robot
- DELETE /api/robots/{id} - Eliminar robot
- GET /api/robots/{robot}/ubicacion - Ubicacion actual

### Rutas
- GET /api/rutas - Listar rutas
- POST /api/rutas/generate - Generar nueva ruta
- GET /api/rutas/{id} - Detalle de ruta
- POST /api/rutas/{ruta}/iniciar - Iniciar ruta
- POST /api/rutas/{ruta}/completar - Completar ruta
- GET /api/rutas/robot/{robot} - Rutas por robot

### IA y Zonas Toxicas
- GET /api/zonas-toxicas - Listar zonas contaminadas
- POST /api/ia/remediar - Activar IA de remediacion

### Biopolimeros
- GET /api/biopolimeros - Listar biopolimeros
- GET /api/biopolimeros/area - Por area geografica
- GET /api/biopolimeros/estadisticas - Estadisticas de crecimiento
- PUT /api/biopolimeros/{id}/actualizar-crecimiento - Actualizar estado

### Sistema
- GET /api/health - Health check del servidor

## Instalacion

### Requisitos Previos
- PHP 8.2 o superior
- Composer
- Node.js 18 o superior
- npm o yarn
- Base de datos (MySQL, PostgreSQL o SQLite)

### Backend (Laravel)

1. Navegar al directorio del backend:
```bash
cd backend/mars
```

2. Instalar dependencias de PHP:
```bash
composer install
```

3. Configurar el archivo .env:
```bash
cp .env.example .env
```

4. Generar clave de aplicacion:
```bash
php artisan key:generate
```

5. Configurar la base de datos en el archivo .env

6. Ejecutar migraciones:
```bash
php artisan migrate
```

7. Iniciar el servidor de desarrollo:
```bash
php artisan serve
```

El servidor estara disponible en http://localhost:8000

### Frontend (React)

1. Navegar al directorio del frontend:
```bash
cd fronted/mars
```

2. Instalar dependencias de Node:
```bash
npm install
```

3. Iniciar el servidor de desarrollo:
```bash
npm run dev
```

El servidor estara disponible en http://localhost:5173

4. Crear un archivo `.env.local` en `fronted/mars/` con tus variables privadas:
```bash
VITE_API_URL=http://127.0.0.1:8000/api
VITE_MAPBOX_TOKEN=tu_token_publico_de_mapbox
```

No subas `.env.local` a GitHub. El archivo `.env.example` queda solo como plantilla sin secretos.

### Desarrollo Concurrente

Para ejecutar ambos servidores simultaneamente, desde el directorio backend/mars:

```bash
composer run dev
```

Este comando iniciara el servidor Laravel, la cola de trabajos, los logs y Vite simultaneamente.

## Estructura del Proyecto

```
reto-marte/
├── backend/
│   └── mars/                 # Laravel Backend
│       ├── app/
│       │   ├── Http/Controllers/  # Controladores API
│       │   ├── Models/            # Modelos Eloquent
│       │   └── Services/          # Logica de negocio (Pathfinding)
│       ├── routes/            # Definicion de rutas API
│       ├── config/            # Configuracion Laravel
│       └── database/          # Migraciones y seeders
├── fronted/
│   └── mars/                 # React Frontend
│       ├── src/
│       │   ├── components/    # Componentes React
│       │   ├── services/      # Servicios API
│       │   └── assets/        # Recursos estaticos
│       └── package.json       # Dependencias Node
└── src/                      # Recursos compartidos
```

## Componentes del Frontend

### Dashboard
Panel principal con navegacion, integracion de todos los modulos, control de IA de remediacion y estado general del sistema.

### MapaMarte
Visualizacion interactiva del mapa con marcadores de robots y rutas, seleccion de mapas multiples y animaciones de movimiento.

### RobotList
Listado de robots con estado, filtros y busqueda, acciones rapidas y detalles de cada robot.

### EstadisticasPanel
KPIs en tiempo real, graficos de simulacion, metricas por ruta y estado de gemelo digital.

### Modales
- GenerateRutaModal: Creacion manual de rutas
- CreateRobotModal: Registro de nuevos robots

## Algoritmos Implementados

### Pathfinding
- Algoritmo A*: Para encontrar rutas optimas entre puntos
- Interpolacion Lineal: Generacion de puntos intermedios para navegacion suave
- Cobertura Zig-Zag: Patron de cobertura para limpieza de areas contaminadas

### IA de Remediacion
- Deteccion automatica de zonas toxicas
- Asignacion inteligente de robots a zonas contaminadas
- Priorizacion basada en nivel de toxicidad
- Optimizacion de recursos disponibles

## Flujo de Trabajo Tipico

1. Registro de Robots: Se agregan robots a la flota con sus capacidades
2. Deteccion de Zonas: El sistema identifica zonas toxicas en Marte
3. Activacion de IA: Se activa la IA de remediacion
4. Asignacion de Rutas: La IA asigna rutas optimas a los robots disponibles
5. Ejecucion: Los robots navegan las rutas y realizan la limpieza
6. Monitoreo: Se visualiza el progreso en tiempo real
7. Completacion: Se registran las rutas completadas y se actualizan estadisticas

## Testing

### Backend
Ejecutar tests de PHPUnit:
```bash
cd backend/mars
php artisan test
```

### Frontend
Ejecutar linting:
```bash
cd fronted/mars
npm run lint
```

## Contribucion

Las contribuciones son bienvenidas. Por favor:
1. Fork el repositorio
2. Cree una rama para su feature (`git checkout -b feature/nueva-feature`)
3. Commit sus cambios (`git commit -am 'Agregar nueva feature'`)
4. Push a la rama (`git push origin feature/nueva-feature`)
5. Abra un Pull Request

## Licencia

Este proyecto esta bajo la Licencia MIT.

## Version

Version actual: v1.1.0
Estado: Activo y Online
Algoritmo Principal: A* + Cobertura Zig-Zag

## Contacto

Para preguntas o soporte, por favor abra un issue en el repositorio.
