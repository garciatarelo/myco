<?php

use App\Http\Controllers\BiopolimeroController;
use App\Http\Controllers\CapsulaController;
use App\Http\Controllers\GemeloDigitalController;
use App\Http\Controllers\IAController;
use App\Http\Controllers\InyeccionController;
use App\Http\Controllers\MedicionController;
use App\Http\Controllers\RobotController;
use App\Http\Controllers\RutaController;
use App\Http\Controllers\TerrenoController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes - Plataforma M.Y.C.O
|--------------------------------------------------------------------------
| Rutas REST para gestión de usuarios, robots Myco (modos lectura e inyección),
| sensores de suelo, cápsulas, inyecciones optimizadas, gemelo digital y simulaciones.
*/

/**
 * 1. Usuarios y Roles (Administradores y Clientes)
 */

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::middleware('jwt')->group(function () {
    Route::get('/user', [AuthController::class, 'getUser']);
    Route::put('/user', [AuthController::class, 'updateUser']);
    Route::post('/logout', [AuthController::class, 'logout']);
});

Route::get('/usuarios', [UserController::class, 'index']);
Route::post('/usuarios', [UserController::class, 'store']);
Route::get('/usuarios/{usuario}', [UserController::class, 'show']);

/**
 * 2. Terrenos y Estaciones Base
 */
Route::get('/estaciones-base', [TerrenoController::class, 'estacionesBase']);
Route::post('/estaciones-base', [TerrenoController::class, 'storeEstacionBase']);
Route::apiResource('terrenos', TerrenoController::class);

/**
 * 3. Robots Myco
 * Modos: lectura e inyección, retorno a estación base, Wi-Fi y configuración
 */
Route::apiResource('robots', RobotController::class);
Route::get('/robots/{robot}/ubicacion', [RobotController::class, 'ubicacion']);
Route::post('/robots/{robot}/cambiar-modo', [RobotController::class, 'cambiarModo']);
Route::post('/robots/{robot}/ir-a-base', [RobotController::class, 'irABase']);
Route::post('/robots/{robot}/recargar', [RobotController::class, 'recargar']);
Route::post('/robots/{robot}/wifi', [RobotController::class, 'configurarWifi']);
Route::put('/robots/{robot}/configuracion', [RobotController::class, 'actualizarConfiguracion']);
Route::post('/robots/{robot}/optimizar-carga', [RobotController::class, 'optimizarCarga']);

/**
 * 4. Mediciones de Suelo (Modo Lectura: pH, temperatura y humedad en coordenadas)
 */
Route::get('/mediciones/recientes', [MedicionController::class, 'recientes']);
Route::get('/mediciones/mapa-calor', [MedicionController::class, 'mapaCalor']);
Route::get('/mediciones', [MedicionController::class, 'index']);
Route::post('/mediciones', [MedicionController::class, 'store']);

/**
 * 5. Cápsulas de Micorrizas (Grados mínimo, medio y alto según cantidad de micorrizas)
 */
Route::get('/capsulas/inventario', [CapsulaController::class, 'inventario']);
Route::apiResource('capsulas', CapsulaController::class);

/**
 * 6. Inyecciones y Algoritmo de Optimización (Modo Inyección y Ahorro de Recursos)
 */
Route::get('/inyecciones/estadisticas', [InyeccionController::class, 'estadisticas']);
Route::post('/inyecciones/ejecutar-optimizada', [InyeccionController::class, 'ejecutarOptimizada']);
Route::post('/inyecciones/recomendar-punto', [InyeccionController::class, 'recomendarPunto']);
Route::apiResource('inyecciones', InyeccionController::class);

/**
 * 7. Gemelo Digital y Simulaciones Temporales (Ideales, Extremas y Planeta Marte)
 */
Route::get('/gemelo-digital/estado', [GemeloDigitalController::class, 'estado']);
Route::post('/gemelo-digital/configuracion', [GemeloDigitalController::class, 'actualizarConfiguracion']);
Route::post('/simulaciones/ejecutar', [GemeloDigitalController::class, 'ejecutarSimulacion']);
Route::get('/simulaciones', [GemeloDigitalController::class, 'simulaciones']);
Route::get('/simulaciones/{simulacion}', [GemeloDigitalController::class, 'detalleSimulacion']);

/**
 * 8. Rutas de Navegación y Pathfinding (Compatibilidad)
 */
Route::post('/rutas/generate', [RutaController::class, 'generate']);
Route::apiResource('rutas', RutaController::class);
Route::get('/rutas/robot/{robot}', [RutaController::class, 'porRobot']);
Route::post('/rutas/{ruta}/iniciar', [RutaController::class, 'iniciar']);
Route::post('/rutas/{ruta}/completar', [RutaController::class, 'completar']);

/**
 * 9. IA y Zonas Tóxicas (Compatibilidad)
 */
Route::get('/zonas-toxicas', [IAController::class, 'getZonasToxicas']);
Route::post('/ia/remediar', [IAController::class, 'remediar']);

/**
 * 10. Biopolímeros (Compatibilidad)
 */
Route::get('/biopolimeros/area', [BiopolimeroController::class, 'porArea']);
Route::get('/biopolimeros/estadisticas', [BiopolimeroController::class, 'estadisticas']);
Route::put('/biopolimeros/{biopolimero}/actualizar-crecimiento', [BiopolimeroController::class, 'actualizarCrecimiento']);
Route::apiResource('biopolimeros', BiopolimeroController::class);

/**
 * 11. Health Check
 */
Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'sistema' => 'M.Y.C.O Backend API',
        'version' => '2.0.0',
        'timestamp' => now(),
    ]);
});