<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

use App\Models\ZonaToxica;
use App\Models\Robot;
use App\Models\Ruta;
use App\Services\PathfindingService;
use Illuminate\Http\JsonResponse;

class IAController extends Controller
{
    public function getZonasToxicas(): JsonResponse
    {
        $zonas = ZonaToxica::where('activa', true)->get();
        return response()->json($zonas);
    }

    public function remediar(Request $request, PathfindingService $pf): JsonResponse
    {
        $entorno = $request->input('entorno', 'mars'); // 'mars' o 'earth'
        
        $zonas = ZonaToxica::where('activa', true)->get()->filter(function ($z) use ($entorno) {
            $isEarth = $z->latitud >= 25 && $z->latitud <= 32 && $z->longitud >= -110 && $z->longitud <= -100;
            return $entorno === 'earth' ? $isEarth : !$isEarth;
        });

        if ($zonas->isEmpty()) {
            return response()->json(['message' => 'No hay zonas toxicas activas'], 404);
        }

        $robots = Robot::all()->filter(function ($r) use ($entorno) {
            $isEarth = $r->latitud_marte >= 25 && $r->latitud_marte <= 32 && $r->longitud_marte >= -110 && $r->longitud_marte <= -100;
            return $entorno === 'earth' ? $isEarth : !$isEarth;
        });

        if ($robots->isEmpty()) {
            return response()->json(['message' => 'No hay robots disponibles'], 404);
        }

        $rutasGeneradas = [];

        foreach ($zonas as $index => $zona) {
            $robot = $robots->values()->get($index % $robots->count());
            
            // Ruta desde el robot hasta la zona, y luego un zigzag en la zona
            $puntos = $pf->findCoveragePath(
                (float) $robot->latitud_marte, 
                (float) $robot->longitud_marte, 
                (float) $zona->latitud, 
                (float) $zona->longitud, 
                (float) $zona->radio
            );

            // Calcular distancia total aproximada
            $distancia_total = count($puntos) * 0.05; // Dummy distance
            $tiempo_estimado = count($puntos) * 5; // Dummy time

            $ruta = Ruta::create([
                'robot_id' => $robot->id,
                'puntos_json' => $puntos,
                'distancia_total' => $distancia_total,
                'tiempo_estimado' => $tiempo_estimado,
                'estado' => 'planificada',
            ]);

            // Desactivar la zona porque ya está siendo atendida
            $zona->update(['activa' => false]);
            $rutasGeneradas[] = $ruta;
        }

        return response()->json([
            'message' => 'IA Remediation Triggered',
            'rutas' => $rutasGeneradas
        ], 200);
    }
}
