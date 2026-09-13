<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Simulacion extends Model
{
    protected $table = 'simulaciones';

    protected $fillable = [
        'nombre',
        'entorno',
        'tipo_condicion',
        'parametros',
        'resultados',
        'terreno_id',
        'robot_id',
        'duracion_dias',
        'cobertura_micelio_porcentaje',
        'estado',
    ];

    protected $casts = [
        'parametros' => 'array',
        'resultados' => 'array',
        'duracion_dias' => 'integer',
        'cobertura_micelio_porcentaje' => 'float',
    ];

    public function terreno(): BelongsTo
    {
        return $this->belongsTo(Terreno::class, 'terreno_id');
    }

    public function robot(): BelongsTo
    {
        return $this->belongsTo(Robot::class, 'robot_id');
    }
}
