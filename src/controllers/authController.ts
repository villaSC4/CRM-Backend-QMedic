import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool as db } from '../config/database';

export const register = async (req: Request, res: Response) => {
    const { name, email, password, role } = req.body;
    
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const [result] = await db.execute(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, role || 'recepcion']
        );

        res.status(201).json({ success: true, message: 'Usuario registrado exitosamente' });
    } catch (error) {
        console.error('Error al registrar usuario:', error);
        res.status(500).json({ success: false, message: 'Error en el servidor al registrar' });
    }
};

export const login = async (req: Request, res: Response): Promise<any> => {
    const rawEmail = req.body.email || req.body.username || req.body.user || req.body.correo;
    const rawPassword = req.body.password || req.body.pass || req.body.contrasena || req.body.clave;

    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    const password = typeof rawPassword === 'string' ? rawPassword.trim() : '';

    console.log(`🔐 Intento de login para email: "${email}"`);

    try {
        const [users]: any = await db.execute('SELECT * FROM users WHERE LOWER(TRIM(email)) = ?', [email]);
        
        if (!users || users.length === 0) {
            console.log(`❌ Usuario no encontrado en DB: "${email}"`);
            return res.status(401).json({ success: false, message: 'Correo o contraseña incorrectos' });
        }

        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            console.log(`❌ Contraseña incorrecta para: "${email}"`);
            return res.status(401).json({ success: false, message: 'Correo o contraseña incorrectos' });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, name: user.name },
            process.env.JWT_SECRET || 'TU_SECRETO_QMEDIC_2024',
            { expiresIn: '8h' }
        );

        console.log(`✅ Login exitoso para: "${user.email}" (${user.name})`);

        res.json({
            success: true,
            message: 'Autenticación exitosa',
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });

    } catch (error) {
        console.error('Error en el login:', error);
        res.status(500).json({ success: false, message: 'Error en el servidor al iniciar sesión' });
    }
};