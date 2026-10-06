<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * GET /api/usuarios - Listar usuarios (administradores y clientes)
     */
    public function index(Request $request): JsonResponse
    {
        $query = User::query();

        if ($request->has('rol')) {
            $query->where('rol', $request->input('rol'));
        }

        $usuarios = $query->with('terrenos')->get();
        return response()->json($usuarios);
    }

    /**
     * POST /api/usuarios - Crear usuario
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:6',
            'rol' => ['required', Rule::in(['admin', 'cliente'])],
            'telefono' => 'nullable|string',
            'organizacion' => 'nullable|string',
        ]);

        $usuario = User::create($validated);
        return response()->json($usuario, 201);
    }

    /**
     * GET /api/usuarios/{id} - Detalle de usuario
     */
    public function show(User $usuario): JsonResponse
    {
        $usuario->load('terrenos');
        return response()->json($usuario);
    }
}
