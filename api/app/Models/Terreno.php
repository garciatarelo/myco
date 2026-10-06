<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Terreno extends Model
{
    protected $table = 'terrenos';

    protected $fillable = [
        'nombre',
        'descripcion',
        'cliente_id',
        'entorno',
        'latitud_central',
        'longitud_central',
        'poligono_coordenadas',
        'dimensiones_m2',
        'red_wifi_ssid',
        'red_wifi_pass',
        'red_wifi_status',
        'condiciones_terreno',
        'elevacion_data',
        'rutas_rovers',
        'clusters_muestreo',
        'puntos_inicio_escaneo',
    ];

    protected $casts = [
        'poligono_coordenadas' => 'array',
        'latitud_central' => 'float',
        'longitud_central' => 'float',
        'dimensiones_m2' => 'float',
        'condiciones_terreno' => 'array',
        'elevacion_data' => 'array',
        'rutas_rovers' => 'array',
        'clusters_muestreo' => 'array',
        'puntos_inicio_escaneo' => 'array',
    ];

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cliente_id');
    }

    public function robots(): HasMany
    {
        return $this->hasMany(Robot::class, 'terreno_id');
    }

    public function estacionesBase(): HasMany
    {
        return $this->hasMany(EstacionBase::class, 'terreno_id');
    }

    public function mediciones(): HasMany
    {
        return $this->hasMany(MedicionSuelo::class, 'terreno_id');
    }

    public function inyecciones(): HasMany
    {
        return $this->hasMany(Inyeccion::class, 'terreno_id');
    }

    public function simulaciones(): HasMany
    {
        return $this->hasMany(Simulacion::class, 'terreno_id');
    }
}
