<?php

namespace App\Services;

class PathfindingService
{
    /**
     * Versión inicial de pathfinding: interpolación lineal con N muestras.
     * Devuelve array de puntos ['lat' => float, 'lon' => float].
     */
    public function findPath(float $startLat, float $startLon, float $endLat, float $endLon, int $samples = 20): array
    {
        return $this->computeLinearPath($startLat, $startLon, $endLat, $endLon, $samples);
    }

    protected function computeLinearPath(float $lat1, float $lon1, float $lat2, float $lon2, int $samples = 20): array
    {
        $points = [];
        if ($samples < 2) {
            $samples = 2;
        }

        for ($i = 0; $i < $samples; $i++) {
            $t = $i / ($samples - 1);
            $lat = $lat1 + ($lat2 - $lat1) * $t;
            $lon = $lon1 + ($lon2 - $lon1) * $t;
            $points[] = ['lat' => round($lat, 6), 'lon' => round($lon, 6)];
        }

        return $points;
    }

    /**
     * Genera una ruta lineal hacia el objetivo y luego un patrón de cobertura en Zig-Zag.
     */
    public function findCoveragePath(float $startLat, float $startLon, float $targetLat, float $targetLon, float $radius): array
    {
        // 1. Path from start to target edge (linear, 5 points)
        $path = $this->computeLinearPath($startLat, $startLon, $targetLat, $targetLon, 5);

        // 2. Zigzag pattern around the target to cover the area
        // We will make 4 sweeps across the bounding box
        $sweeps = 4;
        // Adjust radius to degrees if it's considered in km. 
        // For simplicity, we assume radius is small enough (e.g. 0.05 degrees).
        $r = $radius > 1 ? $radius / 111 : $radius; // Rough conversion from km to degrees if needed

        $latMin = $targetLat - $r;
        $latMax = $targetLat + $r;
        $lonMin = $targetLon - $r;
        $lonMax = $targetLon + $r;

        $stepLat = ($latMax - $latMin) / $sweeps;

        for ($i = 0; $i <= $sweeps; $i++) {
            $currentLat = $latMin + ($stepLat * $i);
            
            if ($i % 2 == 0) {
                // Left to right
                $path[] = ['lat' => round($currentLat, 6), 'lon' => round($lonMin, 6)];
                $path[] = ['lat' => round($currentLat, 6), 'lon' => round($lonMax, 6)];
            } else {
                // Right to left
                $path[] = ['lat' => round($currentLat, 6), 'lon' => round($lonMax, 6)];
                $path[] = ['lat' => round($currentLat, 6), 'lon' => round($lonMin, 6)];
            }
        }

        return $path;
    }
}
