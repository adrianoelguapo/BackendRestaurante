// Modulos necesarios
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

// Configuración de la base de datos
const uri = "mongodb+srv://admin:123@cluster0.tz018.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);
const dbName = "restaurante_dam";
let db;

/* 

FORMATO COLECCIÓN "carta"
{
    _id: ObjectId('690b9f01b7abf0c2595c3118'),
    id: 1,
    name: "Sushi Moriawase",
    category: "Sushi",
    price: 12.50,
    image: "/images/sushi_moriawase.jpg"
}

FORMATO COLECCIÓN "mesas"
{
    _id: ObjectId('690b9f01b7abf0c2595c3118')
    id: 1,
    order: {
        state: "" // pendiente, pagado, cancelado
        products: [
            {
                _id: ObjectId('690b9f01b7abf0c2595c3118'),
                id: 1,
                name: "Sushi Moriawase",
                category: "Sushi",
                price: 12.50,
                image: "/images/sushi_moriawase.jpg"
                quantity: 2
            },
            {
                _id: ObjectId('690b9f01b7abf0c2595c3118'),
                id: 2,
                name: "Sushi de Atún",
                category: "Sushi",
                price: 11.20,
                image: "/images/sushi_atun.jpg"
            }
        ]
    },
    state: true  // true = libre, false = ocupada
}

*/

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

// Middlewares
app.use(cors({
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true
    })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar puerto de escucha
app.listen(3000, () => {

    console.log("Servidor escuchando en el puerto 3000");

});

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

        res.json(table || {})

    } catch (error) {

        console.error("Error al obtener los datos de la mesa:", error);
        res.status(500).json({ error: "Error al obtener los datos de la mesa" })

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
        res.status(200).json({ success: "Se ha ocupado la mesa correctamente" })


    } catch (error) {

        console.error("Error al ocupar la mesa: ", error);
        res.status(500).json({ error: "Error al ocupar la mesa" })

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
            return res.status(404).json({ error: "Mesa no encontrada" })

        }

        console.log("Se ha liberado la mesa correctamente");
        res.status(200).json({ success: "Se ha liberado la mesa correctamente" })

    } catch (error) {

        console.error("Error al liberar la mesa: ", error);
        res.status(500).json({ error: "Error al liberar la mesa" })

    }

});

// POST /api/mesas/:id/pedido -> Añade un producto al pedido de una mesa
app.post("/api/mesas/:id/pedido", async (req, res) => {

    try {

        const menuCollection = db.collection("carta");
        const tablesCollection = db.collection("mesas");
        const tableId = req.params.id;
        const { productId: quantity } = req.body

        const result = await collection.insertOne({  });

    } catch (error) {

        console.error("Error al añadir el producto al pedido de la mesa: ", error);
        res.status(500).json({ error: "Error al añadir el producto al pedido de la mesa" })

    }

});

// PUT /api/mesas/:id/pedido/:productId -> Modifica la cantidad de un producto en el pedido de una mesa
app.put("/api/mesas/:id/pedido", async (req, res) => {

    try {

        const menuCollection = db.collection("carta");
        const tablesCollection = db.collection("mesas");
        const tableId = req.params.id;
        const productId = req.params.productId;

    } catch (error) {

        console.error("Error al modificar la cantidad del producto en el pedido de la mesa: ", error);
        res.status(500).json({ error: "Error al modificar la cantidad del producto de la mesa" })

    }

});

// DELETE /api/mesas/:id/pedido/:productId -> Elimina un producto del pedido de una mesa
app.delete("/api/mesas/:id/pedido/:productId", async (req, res) => {

    try {

        const collection = db.collection("mesas");
        const tableId = req.params.id;
        const productId = req.params.productId;

        const result = await collection.updateOne({ id: tableId }, { $pull: { order:  { id: productId } } });

        if (result.matchedCount === 0) {

            return res.status(404).json({ error: "Mesa no encontrada" });

        }

        res.status(200).json({ success: "Producto eliminado con éxito" });

    } catch (error) {

        console.error("Error al eliminar el producto del pedido de la mesa: ", error);
        res.status(500).json({ error: "Error al eliminar el producto del pedido de la mesa" })

    }

});

// DELETE /api/mesas/:id/pedido -> Elimina el pedido de la mesa y cambia su estado a libre (true). Esto sería cuando el cliente paga y se va
app.delete("/api/mesas/:id/pedido", async (req, res) => {

    try {

        const collection = db.collection("mesas");
        const tableId = req.params.id;

        const result = await collection.updateOne({ id: tableId }, { $set: { order: [], state: true } });

        if (result.matchedCount === 0) {

            return res.status(404).json({ error: "Mesa no encontrada" });

        }

        res.status(200).json({ success: "Pedido pagado y eliminado con éxito" });

    } catch (error) {

        console.error("Error al pagar");
        res.status(500).json({ error: "Error al pagar" })

    }

});

connectDB();