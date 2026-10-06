<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ZonaToxica extends Model
{
    protected $fillable = [
        'latitud',
        'longitud',
        'radio',
        'nivel_toxicidad',
        'activa',
    ];
}
