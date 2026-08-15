"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = exports.register = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../config/database");
const register = async (req, res) => {
    const { name, email, password, role } = req.body;
    try {
        const salt = await bcrypt_1.default.genSalt(10);
        const hashedPassword = await bcrypt_1.default.hash(password, salt);
        const [result] = await database_1.pool.execute('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [name, email, hashedPassword, role || 'recepcion']);
        res.status(201).json({ success: true, message: 'Usuario registrado exitosamente' });
    }
    catch (error) {
        console.error('Error al registrar usuario:', error);
        res.status(500).json({ success: false, message: 'Error en el servidor al registrar' });
    }
};
exports.register = register;
const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const [users] = await database_1.pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Correo o contraseña incorrectos' });
        }
        const user = users[0];
        const validPassword = await bcrypt_1.default.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ success: false, message: 'Correo o contraseña incorrectos' });
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role, name: user.name }, process.env.JWT_SECRET || 'TU_SECRETO_QMEDIC_2024', { expiresIn: '8h' });
        res.json({
            success: true,
            message: 'Autenticación exitosa',
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
    }
    catch (error) {
        console.error('Error en el login:', error);
        res.status(500).json({ success: false, message: 'Error en el servidor al iniciar sesión' });
    }
};
exports.login = login;
