<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Sensor extends Model
{
    protected $table = 'sensores';

    protected $fillable = [
        'robot_id',
        'tipo',
        'valor',
        'ubicacion_lat',
        'ubicacion_lon',
        'timestamp',
    ];

    protected $casts = [
        'timestamp' => 'datetime',
    ];

    public function robot(): BelongsTo
    {
        return $this->belongsTo(Robot::class);
    }
}
