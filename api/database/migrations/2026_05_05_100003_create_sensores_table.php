<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sensores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('robot_id')->constrained('robots')->onDelete('cascade');
            $table->enum('tipo', ['infrarojo', 'humedad', 'toxicidad']);
            $table->decimal('valor', 8, 2);
            $table->decimal('ubicacion_lat', 10, 6);
            $table->decimal('ubicacion_lon', 10, 6);
            $table->timestamp('timestamp');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sensores');
    }
};
