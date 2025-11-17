// Modulos necesarios
const express = require('express');
const { MongoClient } = require('mongodb');
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

// Middleware
app.use(cors({

    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true

}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar puerto de escucha
app.listen(3000, "0.0.0.0", () => {

    console.log("Escucho en el puerto 3000");

});

// GET /api/carta -> Devuelve todos los productos de la carta
app.get("/api/carta", async (req, res) => {

    try {

        const collection = db.collection("carta");
        const products = await collection.find({}).toArray();
        res.json(products);

    } catch (error) {

        res.status(500).json({ error: "Error al obtener la carta" });

    }

});

// GET /api/mesas -> Devuelve los datos de todas las mesas 
app.get("/api/mesas", async (req, res) => {

    try {

        const collection = db.collection("mesas");
        const tables = await collection.find({}).toArray();
        res.json(tables);

    } catch (error) {

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

        res.status(500).json({ error: "Error al obtener los datos de la mesa" });

    }

});

// GET /api/mesas/:tableId/pedido -> Devuelve el pedido completo de una mesa
app.get("/api/mesas/:tableId/pedido", async (req, res) => {

    try {

        const tablesCollection = db.collection("mesas");
        const tableId = parseInt(req.params.tableId);

        const mesa = await tablesCollection.findOne({ id: tableId });

        if (!mesa) {

            return res.status(404).json({ error: "Mesa no encontrada", tableId: tableId });

        }

        if (!mesa.order) {

            return res.json({ tableId: mesa.id, products: [], state: "" });

        }

        const products = mesa.order.products || [];

        const response = {

            tableId: mesa.id,
            products: products,
            state: mesa.order.state || ""

        };

        res.json(response);

    } catch (error) {

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
        
        if (!productId || !quantity) {

            return res.status(400).json({ error: "Se requieren productId y quantity" });

        }

        const mesa = await tablesCollection.findOne({ id: tableId });
        if (!mesa) {

            return res.status(404).json({ error: "Mesa no encontrada" });

        }

        const product = await menuCollection.findOne({ id: productId });
        if (!product) {

            return res.status(404).json({ error: "Producto no encontrado" });

        }

        if (!mesa.order) {

            await tablesCollection.updateOne(

                { id: tableId },
                { $set: { 
                    order: { 

                        state: "",
                        products: [] 

                    } 

                } }

            );

        }

        const mesaActualizada = await tablesCollection.findOne({ id: tableId });
        const existingProduct = mesaActualizada.order.products.find(p => p.id === productId);

        if (existingProduct) {

            const newQuantity = existingProduct.quantity + quantity;

            await tablesCollection.updateOne(

                { id: tableId, "order.products.id": productId },
                { $set: { "order.products.$.quantity": newQuantity } }

            );

            await tablesCollection.updateOne(

                { id: tableId },
                { $set: { "order.state": "en espera" } }

            );

            return res.json({ 

                success: `Cantidad actualizada: ${newQuantity}`,
                state: "en espera"

            });
        }

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
                $set: { "order.state": "en espera" }

            }

        );

        res.json({ success: "Producto añadido", state: "en espera" });

    } catch (error) {

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

            return res.status(404).json({ error: "Mesa no encontrada" });

        }

        res.status(200).json({ success: "Se ha ocupado la mesa correctamente" });

    } catch (error) {

        res.status(500).json({ error: "Error al ocupar la mesa" });

    }

});

// PUT /api/mesas/:id/servir -> Cambia el estado del pedido a "servido"
app.put("/api/mesas/:id/servir", async (req, res) => {

    try {

        const tablesCollection = db.collection("mesas");
        const tableId = parseInt(req.params.id);

        const result = await tablesCollection.updateOne(

            { id: tableId },
            { $set: { "order.state": "servido" } }

        );

        if (result.matchedCount === 0) {

            return res.status(404).json({ error: "Mesa no encontrada" });

        }

        res.status(200).json({ success: "Pedido servido correctamente" });

    } catch (error) {

        res.status(500).json({ error: "Error interno del servidor" });

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

            return res.status(404).json({ error: "Mesa no encontrada" });

        }

        res.status(200).json({ success: "Pedido pagado y eliminado con éxito" });

    } catch (error) {

        res.status(500).json({ error: "Error interno del servidor" });
        
    }

});

connectDB();