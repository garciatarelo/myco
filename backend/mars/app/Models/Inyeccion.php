<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Inyeccion extends Model
{
    protected $table = 'inyecciones';

    protected $fillable = [
        'robot_id',
        'capsula_id',
        'terreno_id',
        'ruta_id',
        'latitud',
        'longitud',
        'grado_capsula',
        'humedad_suelo_detectada',
        'ph_detectado',
        'temperatura_detectada',
        'expansion_micelio_estimada_cm',
        'ahorro_recurso_porcentaje',
        'justificacion_algoritmo',
        'fecha_inyeccion',
    ];

    protected $casts = [
        'latitud' => 'float',
        'longitud' => 'float',
        'humedad_suelo_detectada' => 'float',
        'ph_detectado' => 'float',
        'temperatura_detectada' => 'float',
        'expansion_micelio_estimada_cm' => 'float',
        'ahorro_recurso_porcentaje' => 'float',
        'fecha_inyeccion' => 'datetime',
    ];

    public function robot(): BelongsTo
    {
        return $this->belongsTo(Robot::class, 'robot_id');
    }

    public function capsula(): BelongsTo
    {
        return $this->belongsTo(Capsula::class, 'capsula_id');
    }

    public function terreno(): BelongsTo
    {
        return $this->belongsTo(Terreno::class, 'terreno_id');
    }

    public function ruta(): BelongsTo
    {
        return $this->belongsTo(Ruta::class, 'ruta_id');
    }
}
