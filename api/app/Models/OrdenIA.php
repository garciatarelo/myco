<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrdenIA extends Model
{
    protected $table = 'ordenes_ia';

    protected $fillable = [
        'prioridad',
        'tipo_accion',
        'punto_lat',
        'punto_lon',
        'razon',
        'estado',
        'fecha_creacion',
        'fecha_ejecucion',
    ];

    protected $casts = [
        'fecha_creacion' => 'datetime',
        'fecha_ejecucion' => 'datetime',
    ];

    /**
     * Marcar orden como en progreso
     */
    public function iniciar(): void
    {
        $this->estado = 'en-progreso';
        $this->save();
    }

    /**
     * Completar orden
     */
    public function completar(): void
    {
        $this->estado = 'completada';
        $this->fecha_ejecucion = now();
        $this->save();
    }
}
