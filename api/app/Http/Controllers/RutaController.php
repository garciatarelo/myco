<?php

namespace App\Http\Controllers;

use App\Models\Ruta;
use App\Models\Robot;
use App\Models\Biopolimero;
use App\Services\PathfindingService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class RutaController extends Controller
{
    /**
     * GET /api/rutas - Listar todas las rutas
     */
    public function index(): JsonResponse
    {
        $rutas = Ruta::with('robot', 'biopolimeros')->get();
        return response()->json($rutas);
    }

    /**
     * POST /api/rutas - Crear nueva ruta (Pathfinding básico)
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'robot_id' => 'required|exists:robots,id',
            'puntos_json' => 'required|array|min:2',
            'puntos_json.*.lat' => 'required|numeric',
            'puntos_json.*.lon' => 'required|numeric',
        ]);

        $robot = Robot::find($validated['robot_id']);
        $puntos = $validated['puntos_json'];

        // Calcular distancia total
        $distancia_total = 0;
        for ($i = 0; $i < count($puntos) - 1; $i++) {
            $distancia_total += Ruta::calcularDistancia(
                $puntos[$i]['lat'],
                $puntos[$i]['lon'],
                $puntos[$i + 1]['lat'],
                $puntos[$i + 1]['lon']
            );
        }

        // Estimar tiempo (velocidad del robot: 0.5 km/h)
        $tiempo_estimado = ($distancia_total / 0.5) * 3600; // en segundos

        $ruta = Ruta::create([
            'robot_id' => $validated['robot_id'],
            'puntos_json' => $puntos,
            'distancia_total' => $distancia_total,
            'tiempo_estimado' => $tiempo_estimado,
            'estado' => 'planificada',
        ]);

        return response()->json($ruta, 201);
    }

    /**
     * POST /api/rutas/generate - Generar ruta entre dos coordenadas (usa PathfindingService)
     */
    public function generate(Request $request, PathfindingService $pf): JsonResponse
    {
        $validated = $request->validate([
            'robot_id' => 'required|exists:robots,id',
            'start.lat' => 'required|numeric',
            'start.lon' => 'required|numeric',
            'end.lat' => 'required|numeric',
            'end.lon' => 'required|numeric',
            'samples' => 'nullable|integer|min:2|max:500',
        ]);

        $robot = Robot::find($validated['robot_id']);
        $startLat = $validated['start']['lat'];
        $startLon = $validated['start']['lon'];
        $endLat = $validated['end']['lat'];
        $endLon = $validated['end']['lon'];
        $samples = $validated['samples'] ?? 20;

        $puntos = $pf->findPath($startLat, $startLon, $endLat, $endLon, $samples);

        // Calcular distancia total
        $distancia_total = 0;
        for ($i = 0; $i < count($puntos) - 1; $i++) {
            $distancia_total += Ruta::calcularDistancia(
                $puntos[$i]['lat'],
                $puntos[$i]['lon'],
                $puntos[$i + 1]['lat'],
                $puntos[$i + 1]['lon']
            );
        }

        // Estimar tiempo (velocidad del robot: 0.5 km/h)
        $tiempo_estimado = ($distancia_total / 0.5) * 3600; // en segundos

        $ruta = Ruta::create([
            'robot_id' => $validated['robot_id'],
            'puntos_json' => $puntos,
            'distancia_total' => $distancia_total,
            'tiempo_estimado' => $tiempo_estimado,
            'estado' => 'planificada',
        ]);

        return response()->json($ruta, 201);
    }

    /**
     * GET /api/rutas/{id} - Obtener detalles de una ruta
     */
    public function show(Ruta $ruta): JsonResponse
    {
        $ruta->load('robot', 'biopolimeros');
        return response()->json($ruta);
    }

    /**
     * PUT /api/rutas/{id} - Actualizar estado de ruta
     */
    public function update(Request $request, Ruta $ruta): JsonResponse
    {
        $validated = $request->validate([
            'estado' => 'nullable|in:planificada,en-progreso,completada,cancelada',
        ]);

        $ruta->update($validated);
        return response()->json($ruta);
    }

    /**
     * GET /api/rutas/robot/{robot_id} - Historial de rutas de un robot
     */
    public function porRobot(Robot $robot): JsonResponse
    {
        $rutas = $robot->rutas()->with('biopolimeros')->get();
        return response()->json($rutas);
    }

    /**
     * POST /api/rutas/{id}/iniciar - Iniciar ejecución de ruta
     */
    public function iniciar(Ruta $ruta): JsonResponse
    {
        $ruta->update(['estado' => 'en-progreso']);
        
        // Aquí iría lógica para "enviar" orden al robot real
        
        return response()->json([
            'message' => 'Ruta iniciada',
            'ruta' => $ruta,
        ]);
    }

    /**
     * POST /api/rutas/{id}/completar - Marcar ruta como completada
     */
    public function completar(Ruta $ruta): JsonResponse
    {
        $ruta->update(['estado' => 'completada']);
        
        // Simular la siembra de biopolímeros en los puntos de la ruta
        $puntos = $ruta->puntos_json;
        if (is_array($puntos) && count($puntos) > 0) {
            $tipos = ['Pleurotus ostreatus', 'Ganoderma lucidum', 'Trametes versicolor'];
            foreach ($puntos as $punto) {
                // Probabilidad de 40% de plantar un biopolímero en cada punto
                if (rand(1, 100) <= 40) {
                    \App\Models\Biopolimero::create([
                        'ruta_id' => $ruta->id,
                        'latitud_marte' => $punto['lat'] ?? 0,
                        'longitud_marte' => $punto['lon'] ?? 0,
                        'tipo_micelio' => $tipos[array_rand($tipos)],
                        'humedad_detectada' => rand(10, 80),
                        'toxicidad' => rand(0, 40),
                        'fecha_siembra' => now(),
                        'nivel_crecimiento' => rand(10, 95),
                    ]);
                }
            }
        }
        
        return response()->json([
            'message' => 'Ruta completada y biopolímeros sembrados',
            'ruta' => $ruta,
        ]);
    }

    /**
     * DELETE /api/rutas/{id} - Eliminar una ruta y sus biopolímeros asociados
     */
    public function destroy(Ruta $ruta): JsonResponse
    {
        $rutaId = $ruta->id;
        $ruta->delete();

        return response()->json([
            'message' => 'Ruta eliminada',
            'ruta_id' => $rutaId,
        ]);
    }
}
