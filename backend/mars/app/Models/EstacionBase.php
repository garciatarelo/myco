<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EstacionBase extends Model
{
    protected $table = 'estaciones_base';

    protected $fillable = [
        'nombre',
        'terreno_id',
        'latitud',
        'longitud',
        'estado',
        'stock_capsulas_minimo',
        'stock_capsulas_medio',
        'stock_capsulas_alto',
    ];

    public function terreno(): BelongsTo
    {
        return $this->belongsTo(Terreno::class, 'terreno_id');
    }

    public function robots(): HasMany
    {
        return $this->hasMany(Robot::class, 'estacion_base_id');
    }
}
