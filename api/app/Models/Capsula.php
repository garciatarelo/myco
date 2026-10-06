<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Capsula extends Model
{
    protected $table = 'capsulas';

    protected $fillable = [
        'nombre',
        'grado',
        'cantidad_micorrizas',
        'unidad_medida',
        'tipo_hongo',
        'humedad_suelo_optima_min',
        'humedad_suelo_optima_max',
        'radio_expansion_estimado_m',
        'costo_recurso',
        'descripcion',
        'activa',
    ];

    protected $casts = [
        'cantidad_micorrizas' => 'integer',
        'humedad_suelo_optima_min' => 'float',
        'humedad_suelo_optima_max' => 'float',
        'radio_expansion_estimado_m' => 'float',
        'costo_recurso' => 'float',
        'activa' => 'boolean',
    ];

    public function inyecciones(): HasMany
    {
        return $this->hasMany(Inyeccion::class, 'capsula_id');
    }
}
