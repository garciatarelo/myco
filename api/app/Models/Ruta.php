<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Ruta extends Model
{
    protected $fillable = [
        'robot_id',
        'puntos_json',
        'distancia_total',
        'tiempo_estimado',
        'estado',
    ];

    protected $casts = [
        'puntos_json' => 'array',
    ];

    public function robot(): BelongsTo
    {
        return $this->belongsTo(Robot::class);
    }

    public function biopolimeros(): HasMany
    {
        return $this->hasMany(Biopolimero::class);
    }

    /**
     * Calcular distancia entre dos puntos en Marte (aproximación)
     * Usa fórmula Haversine
     */
    public static function calcularDistancia(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $radioMarte = 3389.5; // km
        
        $lat1 = deg2rad($lat1);
        $lon1 = deg2rad($lon1);
        $lat2 = deg2rad($lat2);
        $lon2 = deg2rad($lon2);

        $dlat = $lat2 - $lat1;
        $dlon = $lon2 - $lon1;

        $a = sin($dlat / 2) ** 2 + cos($lat1) * cos($lat2) * sin($dlon / 2) ** 2;
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $radioMarte * $c;
    }
}
