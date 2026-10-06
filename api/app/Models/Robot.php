<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Robot extends Model
{
    protected $fillable = [
        'nombre',
        'modelo',
        'numero_serie',
        'terreno_id',
        'estacion_base_id',
        'estado',
        'modo',
        'latitud_marte',
        'longitud_marte',
        'latitud',
        'longitud',
        'bateria',
        'en_estacion_base',
        'wifi_ssid',
        'wifi_conectado',
        'wifi_ip',
        'wifi_rssi',
        'capacidad_capsulas',
        'capsulas_minimo',
        'capsulas_medio',
        'capsulas_alto',
        'configuracion',
        'sensores_ir',
    ];

    protected $casts = [
        'sensores_ir' => 'array',
        'configuracion' => 'array',
        'en_estacion_base' => 'boolean',
        'wifi_conectado' => 'boolean',
        'bateria' => 'integer',
        'capacidad_capsulas' => 'integer',
        'capsulas_minimo' => 'integer',
        'capsulas_medio' => 'integer',
        'capsulas_alto' => 'integer',
    ];

    public function terreno(): BelongsTo
    {
        return $this->belongsTo(Terreno::class, 'terreno_id');
    }

    public function estacionBase(): BelongsTo
    {
        return $this->belongsTo(EstacionBase::class, 'estacion_base_id');
    }

    public function rutas(): HasMany
    {
        return $this->hasMany(Ruta::class);
    }

    public function sensores(): HasMany
    {
        return $this->hasMany(Sensor::class);
    }

    public function mediciones(): HasMany
    {
        return $this->hasMany(MedicionSuelo::class);
    }

    public function inyecciones(): HasMany
    {
        return $this->hasMany(Inyeccion::class);
    }

    public function simulaciones(): HasMany
    {
        return $this->hasMany(Simulacion::class);
    }

    /**
     * Total de cápsulas actualmente cargadas en el robot
     */
    public function getCapsulasTotalAttribute(): int
    {
        return ($this->capsulas_minimo ?? 0) + ($this->capsulas_medio ?? 0) + ($this->capsulas_alto ?? 0);
    }

    /**
     * Consumir una cápsula según el grado
     */
    public function consumirCapsula(string $grado): bool
    {
        $columna = match ($grado) {
            'alto' => 'capsulas_alto',
            'medio' => 'capsulas_medio',
            'minimo' => 'capsulas_minimo',
            default => null,
        };

        if (!$columna || $this->{$columna} <= 0) {
            return false;
        }

        $this->decrement($columna);
        return true;
    }

    /**
     * Retornar a la base de recarga
     */
    public function retornarABase(): void
    {
        $this->update([
            'estado' => 'retornando_base',
        ]);

        if ($this->estacionBase) {
            $this->update([
                'latitud' => $this->estacionBase->latitud,
                'longitud' => $this->estacionBase->longitud,
                'latitud_marte' => $this->estacionBase->latitud,
                'longitud_marte' => $this->estacionBase->longitud,
                'en_estacion_base' => true,
                'estado' => 'recargando',
            ]);
        }
    }

    /**
     * Recargar batería y reabastecer cápsulas en la base
     */
    public function recargar(): void
    {
        $porTipo = (int) floor($this->capacidad_capsulas / 3);
        $resto = $this->capacidad_capsulas % 3;

        $this->update([
            'bateria' => 100,
            'capsulas_minimo' => $porTipo + $resto,
            'capsulas_medio' => $porTipo,
            'capsulas_alto' => $porTipo,
            'en_estacion_base' => true,
            'estado' => 'activo',
        ]);
    }

    /**
     * Obtener la última posición conocida del robot
     */
    public function ultimaPosicion(): array
    {
        return [
            'latitud' => $this->latitud ?? $this->latitud_marte,
            'longitud' => $this->longitud ?? $this->longitud_marte,
        ];
    }
}
