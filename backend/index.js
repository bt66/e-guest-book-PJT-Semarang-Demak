import express from "express";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import { google } from "googleapis";
import multer from "multer";
import path from "path";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors()); // Enable CORS for all routes
app.use(bodyParser.json());
const port = 3000;

// Configure multer for memory storage to handle file uploads
const upload = multer({ storage: multer.memoryStorage() });

const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
const auth = new google.auth.GoogleAuth({
  credentials, // service account key
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

// S3 client setup
const s3 = new S3Client({
  region: process.env.S3_REGION, // iDrive e2 requires a region, use a valid AWS region format like "us-east-1"
  endpoint: process.env.S3_ENDPOINT, // your custom endpoint
  forcePathStyle: true, // e.g. "ap-southeast-1"
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const bucketName = process.env.S3_BUCKET;
// ✅ Route 1: Directly stream file to client (download/preview inline)
app.get("/file/:key", async (req, res) => {
  try {
    const key = req.params.key;

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const response = await s3.send(command);

    // Set content-type so browser can preview (image, pdf, etc.)
    res.setHeader("Content-Type", response.ContentType || "application/octet-stream");

    // Pipe the stream to client
    response.Body.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error retrieving file from S3");
  }
});

// ✅ Route 2: Generate signed URL (best for frontend preview)
app.get("/file-url/:key", async (req, res) => {
  try {
    const key = req.params.key;

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 60 }); // 60 seconds
    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating signed URL");
  }
});

// ✅ Route 3: Gabungan endpoint untuk unggah file dan kirim data
app.post("/submit-guest", upload.single("foto"), async (req, res) => {
  // 1. Ambil data dari request
  const { nama, asalInstansi, keterangan } = req.body;
  const file = req.file;

  if (!nama || !asalInstansi || !keterangan || !file) {
    return res.status(400).json({ success: false, error: "Data atau file tidak lengkap." });
  }

  // 2. Unggah file ke S3
  const timestamp = Date.now();
  const extension = path.extname(file.originalname); // -> .jpg
  const s3Key = `guest-${timestamp}${extension}`; // -> guest-1678886400000.jpg
  const fotoUrl = `${process.env.BACKEND_ENDPOINT}/file/${s3Key}`; // URL to stream the file later

  try {
    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: "public-read", // Make file publicly accessible
    });
    await s3.send(uploadCommand);
  } catch (err) {
    console.error("S3 Upload Error:", err);
    return res.status(500).json({ success: false, error: "Gagal mengunggah gambar." });
  }

  // 3. Tambahkan data ke Google Sheets
  const dateAdded = new Date().toISOString();
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const spreadsheetId = "1KX7PG1mjIwcyrLZK65z6hz1W-tcOlxWWpkahIo3b05A";
    const range = "Sheet1!A:E"; // A: Timestamp, B: Nama, C: Instansi, D: Keterangan, E: Foto URL
    const values = [[dateAdded, nama, asalInstansi, keterangan, fotoUrl]];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: { values },
    });

    // 4. Kirim respons sukses sesuai permintaan
    res.json({
      success: true,
      data: {
        dateAdded,
        imageUrl: fotoUrl,
        nama,
        asalInstansi,
        keterangan,
      },
    });
  } catch (err) {
    console.error("Google Sheets Error:", err.response?.data || err.message);
    res.status(500).json({ success: false, error: "Gagal menyimpan ke spreadsheet." });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
