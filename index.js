// Modulos necesarios
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');

// Configuración de la base de datos
const uri = "mongodb+srv://admin:123@cluster0.tz018.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);
const dbName = "restaurante_dam";
let db;

// Conexión a la base de datos
async function connectDB() {
    try {
        await client.connect();
        db = client.db(dbName);
        console.log("Conectado a la base de datos");
    } catch (error) {
        console.error("Error al conectar con la base de datos:", error);
    }
}

// Crear instancia de Express
const app = express();

// Middlewares - IMPORTANTE: Colocar ANTES de las rutas
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== RUTAS DE LA API =====

// GET /api/carta -> Devuelve todos los productos de la carta
app.get("/api/carta", async (req, res) => {
    try {
        const collection = db.collection("carta");
        const products = await collection.find({}).toArray();
        res.json(products);
    } catch (error) {
        console.error("Error al obtener la carta:", error);
        res.status(500).json({ error: "Error al obtener la carta" });
    }
});

// GET /api/carta/:category -> Devuelve los productos de una categoría específica
app.get("/api/carta/:category", async (req, res) => {
    try {
        const category = req.params.category;
        const collection = db.collection("carta");
        const products = await collection.find({ category: category }).toArray();
        res.json(products);
    } catch (error) {
        console.error("Error al obtener los productos de la categoría seleccionada: ", error);
        res.status(500).json({ error: "Error al obtener los productos de la categoría seleccionada." });
    }
});

// GET /api/mesas -> Devuelve los datos de todas las mesas 
app.get("/api/mesas", async (req, res) => {
    try {
        const collection = db.collection("mesas");
        const tables = await collection.find({}).toArray();
        res.json(tables);
    } catch (error) {
        console.error("Error al obtener los datos de las mesas:", error);
        res.status(500).json({ error: "Error al obtener los datos de las mesas" });
    }
});

// GET /api/mesas/:id -> Devuelve los datos de una mesa en concreto
app.get("/api/mesas/:id", async (req, res) => {
    try {
        const collection = db.collection("mesas");
        const tableId = parseInt(req.params.id);
        const table = await collection.findOne({id: tableId});
        res.json(table || {});
    } catch (error) {
        console.error("Error al obtener los datos de la mesa:", error);
        res.status(500).json({ error: "Error al obtener los datos de la mesa" });
    }
});

// ===== RUTAS DE PEDIDOS - IMPORTANTE: Este orden específico =====

// GET /api/mesas/:tableId/pedido -> Devuelve el pedido completo de una mesa
app.get("/api/mesas/:tableId/pedido", async (req, res) => {
    try {
        const tablesCollection = db.collection("mesas");
        const tableId = parseInt(req.params.tableId);

        console.log(`🔍 [GET PEDIDO] Buscando pedido para mesa: ${tableId}`);

        const mesa = await tablesCollection.findOne({ id: tableId });

        if (!mesa) {
            console.log(`❌ Mesa ${tableId} no encontrada`);
            return res.status(404).json({ 
                error: "Mesa no encontrada",
                tableId: tableId 
            });
        }

        console.log(`✅ Mesa encontrada, tiene order?: ${!!mesa.order}`);

        // Si no existe order, devolver estructura vacía
        if (!mesa.order) {
            return res.json({
                tableId: mesa.id,
                products: [],
                state: "vacio"
            });
        }

        // Asegurar que products es un array
        const products = mesa.order.products || [];

        console.log(`📦 Enviando ${products.length} productos`);

        const response = {
            tableId: mesa.id,
            products: products,
            state: mesa.order.state || "pendiente"
        };

        res.json(response);

    } catch (error) {
        console.error("❌ Error al obtener el pedido:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// POST /api/mesas/:id/pedido -> Añadir producto (sumando cantidad si ya existe)
app.post("/api/mesas/:id/pedido", async (req, res) => {
    try {
        const menuCollection = db.collection("carta");
        const tablesCollection = db.collection("mesas");

        const tableId = parseInt(req.params.id);
        const { productId, quantity } = req.body;

        console.log(`📥 Añadiendo producto: mesa=${tableId}, producto=${productId}, cantidad=${quantity}`);

        if (!productId || !quantity) {
            return res.status(400).json({ error: "Se requieren productId y quantity" });
        }

        const mesa = await tablesCollection.findOne({ id: tableId });
        if (!mesa) {
            console.log(`❌ Mesa ${tableId} no encontrada`);
            return res.status(404).json({ error: "Mesa no encontrada" });
        }

        const product = await menuCollection.findOne({ id: productId });
        if (!product) {
            console.log(`❌ Producto ${productId} no encontrado en la carta`);
            return res.status(404).json({ error: "Producto no encontrado" });
        }

        console.log(`✅ Producto encontrado:`, product.name);

        // Inicializar order si no existe
        if (!mesa.order) {
            console.log(`📝 Inicializando order para mesa ${tableId}`);
            await tablesCollection.updateOne(
                { id: tableId },
                { $set: { 
                    order: { 
                        state: "en espera",  // Estado inicial
                        products: [] 
                    } 
                } }
            );
        }

        // Buscar la mesa actualizada
        const mesaActualizada = await tablesCollection.findOne({ id: tableId });
        const existingProduct = mesaActualizada.order.products.find(p => p.id === productId);

        if (existingProduct) {
            // Actualizar cantidad si el producto ya existe
            const newQuantity = existingProduct.quantity + quantity;
            console.log(`🔄 Actualizando cantidad: ${existingProduct.quantity} + ${quantity} = ${newQuantity}`);

            await tablesCollection.updateOne(
                { id: tableId, "order.products.id": productId },
                { $set: { "order.products.$.quantity": newQuantity } }
            );

            // Actualizar estado a "en espera" cuando se modifica un producto
            await tablesCollection.updateOne(
                { id: tableId },
                { $set: { "order.state": "en espera" } }
            );

            return res.json({ 
                success: `Cantidad actualizada: ${newQuantity}`,
                state: "en espera"
            });
        }

        // Añadir nuevo producto
        console.log(`➕ Añadiendo nuevo producto al pedido`);
        const productToAdd = {
            id: product.id,
            name: product.name,
            category: product.category,
            price: product.price,
            quantity: quantity
        };

        await tablesCollection.updateOne(
            { id: tableId },
            { 
                $push: { "order.products": productToAdd },
                $set: { "order.state": "en espera" }  // Establecer estado al añadir producto
            }
        );

        console.log(`✅ Producto añadido correctamente, estado: en espera`);
        res.json({ 
            success: "Producto añadido",
            state: "en espera"
        });

    } catch (error) {
        console.error("❌ Error al añadir producto:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// PUT /api/mesas/:id/ocupar -> Cambia el estado de una mesa a ocupado (false)
app.put("/api/mesas/:id/ocupar", async (req, res) => {
    try {
        const collection = db.collection("mesas");
        const tableId = parseInt(req.params.id);

        const result = await collection.updateOne({ id: tableId }, { $set: { state: false } });

        if (result.matchedCount === 0) {
            console.log("Mesa no encontrada");
            return res.status(404).json({ error: "Mesa no encontrada" });
        }
        
        console.log("Se ha ocupado la mesa correctamente");
        res.status(200).json({ success: "Se ha ocupado la mesa correctamente" });

    } catch (error) {
        console.error("Error al ocupar la mesa: ", error);
        res.status(500).json({ error: "Error al ocupar la mesa" });
    }
});

// PUT /api/mesas/:id/liberar -> Cambia el estado de una mesa a libre (true)
app.put("/api/mesas/:id/liberar", async (req, res) => {
    try {
        const collection = db.collection("mesas");
        const tableId = parseInt(req.params.id);

        const result = await collection.updateOne({ id: tableId }, { $set: { state: true } });

        if (result.matchedCount === 0) {
            console.log("Mesa no encontrada");
            return res.status(404).json({ error: "Mesa no encontrada" });
        }

        console.log("Se ha liberado la mesa correctamente");
        res.status(200).json({ success: "Se ha liberado la mesa correctamente" });

    } catch (error) {
        console.error("Error al liberar la mesa: ", error);
        res.status(500).json({ error: "Error al liberar la mesa" });
    }
});

// PUT /api/mesas/:id/pedido/:productId -> Modifica la cantidad de un producto en el pedido de una mesa y pone el pedido en espera
app.put("/api/mesas/:id/pedido/:productId", async (req, res) => {
    try {
        const tablesCollection = db.collection("mesas");
        const tableId = parseInt(req.params.id);
        const productId = parseInt(req.params.productId);
        const { quantity } = req.body;

        if (!quantity || quantity <= 0) {
            return res.status(400).json({ error: "La cantidad debe ser mayor a 0" });
        }

        console.log(`🔄 Actualizando producto ${productId} en mesa ${tableId}, cantidad: ${quantity}`);

        // Primero, actualizar la cantidad del producto específico
        const updateQuantityResult = await tablesCollection.updateOne(
            { id: tableId, "order.products.id": productId },
            { 
                $set: { 
                    "order.products.$.quantity": quantity
                }
            }
        );

        if (updateQuantityResult.matchedCount === 0) {
            console.log(`❌ Mesa ${tableId} o producto ${productId} no encontrado`);
            return res.status(404).json({ error: "Mesa o producto no encontrado" });
        }

        // Luego, actualizar el estado del pedido a "en espera"
        const updateStateResult = await tablesCollection.updateOne(
            { id: tableId },
            { 
                $set: { 
                    "order.state": "en espera"
                }
            }
        );

        console.log(`✅ Cantidad actualizada y estado del pedido cambiado a "en espera"`);
        res.status(200).json({ 
            success: "Cantidad del producto modificada correctamente",
            state: "en espera"
        });

    } catch (error) {
        console.error("Error al modificar la cantidad del producto en el pedido de la mesa: ", error);
        res.status(500).json({ error: "Error al modificar la cantidad del producto de la mesa" });
    }
});

// DELETE /api/mesas/:id/pedido -> Elimina el pedido de la mesa y cambia su estado a libre (true)
app.delete("/api/mesas/:id/pedido", async (req, res) => {
    try {
        const collection = db.collection("mesas");
        const tableId = parseInt(req.params.id);

        const result = await collection.updateOne(
            { id: tableId },
            { 
                $set: { 
                    order: { state: "pagado", products: [] },
                    state: true
                } 
            }
        );

        if (result.matchedCount === 0) {
            console.log(`[DELETE] ❌ Mesa ${tableId} no encontrada`);
            return res.status(404).json({ error: "Mesa no encontrada" });
        }

        console.log(`[DELETE] ✅ Pedido de mesa ${tableId} pagado.`);
        res.status(200).json({ success: "Pedido pagado y eliminado con éxito" });

    } catch (error) {
        console.error("❌ Error al pagar:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// ===== INICIAR SERVIDOR =====

// Configurar puerto de escucha
app.listen(3000, "0.0.0.0", () => {
    console.log("🚀 Servidor escuchando en el puerto 3000");
    console.log("📡 Rutas disponibles:");
    console.log("   GET  /api/carta");
    console.log("   GET  /api/carta/:category");
    console.log("   GET  /api/mesas");
    console.log("   GET  /api/mesas/:id");
    console.log("   GET  /api/mesas/:tableId/pedido");
    console.log("   POST /api/mesas/:id/pedido");
    console.log("   PUT  /api/mesas/:id/ocupar");
    console.log("   PUT  /api/mesas/:id/liberar");
    console.log("   PUT  /api/mesas/:id/pedido/:productId");
    console.log("   DELETE /api/mesas/:id/pedido/:productId");
    console.log("   DELETE /api/mesas/:id/pedido");
});

connectDB();