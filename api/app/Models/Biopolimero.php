<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Biopolimero extends Model
{
    protected $fillable = [
        'ruta_id',
        'latitud_marte',
        'longitud_marte',
        'tipo_micelio',
        'nivel_crecimiento',
        'humedad_detectada',
        'toxicidad',
        'fecha_siembra',
        'fecha_cosecha',
    ];

    protected $casts = [
        'fecha_siembra' => 'datetime',
        'fecha_cosecha' => 'datetime',
    ];

    public function ruta(): BelongsTo
    {
        return $this->belongsTo(Ruta::class);
    }

    /**
     * Simular crecimiento del micelio basado en condiciones
     */
    public function actualizarCrecimiento(): void
    {
        // Humedad óptima: 60-80%
        $humedadOptima = 70;
        $humedad = $this->humedad_detectada ?? 50;
        $factor_humedad = 1 - (abs($humedad - $humedadOptima) / 100);

        // Toxicidad reduce crecimiento
        $toxicidad = $this->toxicidad ?? 0;
        $factor_toxicidad = 1 - ($toxicidad / 100);

        // Tasa de crecimiento
        $incremento = 0.5 * $factor_humedad * $factor_toxicidad;
        $this->nivel_crecimiento = min(100, $this->nivel_crecimiento + $incremento);
        $this->save();
    }

    /**
     * Determinar si el biopolímero está "maduro" (listo para remediación)
     */
    public function estaMaduro(): bool
    {
        return $this->nivel_crecimiento >= 80;
    }
}
