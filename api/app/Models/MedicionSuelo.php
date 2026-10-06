<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MedicionSuelo extends Model
{
    protected $table = 'mediciones_suelo';

    protected $fillable = [
        'robot_id',
        'terreno_id',
        'latitud',
        'longitud',
        'ph',
        'temperatura',
        'humedad',
        'conductividad',
        'es_optimo_inyeccion',
        'grado_sugerido',
        'fecha_medicion',
    ];

    protected $casts = [
        'latitud' => 'float',
        'longitud' => 'float',
        'ph' => 'float',
        'temperatura' => 'float',
        'humedad' => 'float',
        'conductividad' => 'float',
        'es_optimo_inyeccion' => 'boolean',
        'fecha_medicion' => 'datetime',
    ];

    public function robot(): BelongsTo
    {
        return $this->belongsTo(Robot::class, 'robot_id');
    }

    public function terreno(): BelongsTo
    {
        return $this->belongsTo(Terreno::class, 'terreno_id');
    }
}
