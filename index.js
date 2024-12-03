const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const multer = require("multer");
const { MongoClient, ObjectId, ListCollectionsCursor } = require("mongodb");
const cors = require("cors");
const { default: mongoose } = require("mongoose");
const { v2: cloudinary } = require("cloudinary");
const compression = require("compression");
const jwt = require("jsonwebtoken");
const Schema = mongoose.Schema;
const secretKey = "secretKey";
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const excelJS = require("exceljs");

const nodemailer = require("nodemailer");

cloudinary.config({
  cloud_name: "ddkfnfogy",
  api_key: "334596987219218",
  api_secret: "l4qgbRyi6Pjef0Ypu5vi3lvZnk0",
});

// for filtering
const path = require("path");
const fs = require("fs");
const users = require("./db.json");
const blogs = require("./blogs.json");
const { error } = require("console");

// app.use(bodyParser.urlencoded({ extended: true }));
// app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static("public"));

app.use(compression());

app.use(cors());

const storage = multer.diskStorage({
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

const mongoURI =
  // "mongodb+srv://shravan:1234@cluster0.twakfwc.mongodb.net/formsData?retryWrites=true&w=majority&appName=Cluster0";
  "mongodb+srv://shravan:1234@cluster0.twakfwc.mongodb.net/formsData?retryWrites=true&w=majority&appName=Cluster0";

mongoose
  .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("connection successfull");
  })
  .catch((err) => console.log(err));

// Define a user schema and model
const userSchema = new mongoose.Schema({
  username: String,
  password: String, // Store hashed passwords (not applied till now)
  role: String,
});

const User = mongoose.model("admin", userSchema);

app.get("/msg", (req, res) => {
  res.status(200).send({
    msg: "APIs are working successfully",
  });
});

// port testing
const port = 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// ------------------------------- sign up and login ----------------------------------------------------------

// curiotory admin login api
app.post("/register", async (req, res) => {
  const { username, password, role } = req.body;

  // Check if the username already exists
  const existingUser = await User.findOne({ username });
  if (existingUser) {
    return res.status(400).json({ message: "Username already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = new User({
    username,
    password: hashedPassword,
    role,
  });

  await newUser.save();
  res.status(201).json({ message: "User registered successfully" });
});

// Authenticate user function
const authenticateUser = async (username, password) => {
  const user = await User.findOne({ username });
  if (user && (await bcrypt.compare(password, user.password))) {
    return user;
  }
  return null;
};

// taking login details
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const user = await authenticateUser(username, password);
  if (!user) {
    return res.status(401).json({ message: "Invalid username or password" });
  }

  const payload = { username: user.username, role: user.role };

  jwt.sign(payload, secretKey, { expiresIn: "300s" }, (err, token) => {
    if (err) {
      return res.status(500).json({ message: "Internal server error" });
    }
    console.log({ token, role: user.role });
    res.json({ token, role: user.role });
    // res.json({ token });
  });
});

// for accessing the profile
app.post("/profile", verifyToken, (req, res) => {
  jwt.verify(req.token, secretKey, (err, authData) => {
    if (err) {
      res.send({
        message: "Invalid Login",
      });
    } else {
      res.json({
        message: "profile accessed",
        authData,
      });
    }
  });
});

//   for verifying the token
function verifyToken(req, res, next) {
  const bearerHeader = req.headers["authorization"];
  if (typeof bearerHeader !== "undefined") {
    const bearer = bearerHeader.split(" ");
    const token = bearer[1];
    req.token = token;
    next();
  } else {
    res.send({
      result: "invalid login",
    });
  }
}

// ------------------------------- blogs ----------------------------------------------------------

// to assign 404 status code for this blog since it was deleted but still was getting indexed by google (issue has been resolved)
app.get(
  "https:qurocity.ai/blogs/learn-multiple-languages-66cc673bb75ebff8f5a9529d",
  (req, res) => {
    res.status(404).send("This page has been removed");
  }
);

// redirecting to 301 error for urls having multiple id's in url -> seo issue
// app.get("/blogs/:slug", async (req, res) => {
//   const slug = req.params.slug;

//   // Check if the slug contains duplicate segments (e.g., '-<id>-<id>')
//   const slugParts = slug.split('-');
//   const lastPart = slugParts[slugParts.length - 1];

//   if (slugParts[slugParts.length - 2] === lastPart) {
//     // Redirect to the correct URL without the duplicate part
//     const correctSlug = slugParts.slice(0, slugParts.length - 1).join('-');
//     // Set the old URL (with duplicate IDs) to return a 404 Not Found
//     return res.status(404).send("Blog not found at this URL. Redirecting...");
//   }

//   // Proceed to fetch and display the blog using the clean slug
//   try {
//     const blog = await collection.findOne({ urlTitle: slug });
//     if (!blog) {
//       return res.status(404).send("Blog not found");
//     }
//     res.json(blog);
//   } catch (err) {
//     console.error("Error:", err);
//     res.status(500).send("Internal Server Error");
//   }
// });

// getting current date
function getCurrentDate() {
  const currentDate = new Date();
  const day = currentDate.getDate();
  const monthNames = [
    "Jan",
    "Feb",
    "March",
    "April",
    "May",
    "Jun",
    "July",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = monthNames[currentDate.getMonth()];
  const year = currentDate.getFullYear();
  return `${day} ${month} ${year}`;
}

// fetch url title by ID -> used for redirection from old to new urls
app.get("/api/blogs/slug/:id", async (req, res) => {
  const blogId = req.params.id;

  try {
    if (!ObjectId.isValid(blogId)) {
      return res.status(400).json({ message: "Invalid blog ID" });
    }

    const client = new MongoClient(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();

    const db = client.db("formsData");
    const collection = db.collection("blogs");

    const blogObjectId = new ObjectId(blogId);
    const blog = await collection.findOne(
      { _id: blogObjectId },
      { projection: { urlTitle: 1, _id: 0 } }
    );

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    res.json(blog);
    await client.close();
  } catch (err) {
    console.error("Error fetching blog slug:", err);
    res.status(500).send("Internal Server Error");
  }
});

// for the website and admin dashboard
app.get("/api/blogs", async (req, res) => {
  console.log("in api blogs");
  try {
    const client = new MongoClient(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();

    const db = client.db("formsData");
    const collection = db.collection("blogs");

    const blogs = await collection.find({}).sort({ _id: -1 }).toArray(); // Sort in descending order
    res.json(blogs);

    await client.close();
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Internal Server Error");
  }
});

// utility function for slugification
function slugify(title) {
  return title
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word characters
    .replace(/\-\-+/g, "-"); // Replace multiple - with single -
}

// creating a new blog
app.post("/api/blogs", async (req, res) => {
  const newBlog = req.body;
  newBlog.date = getCurrentDate();
  newBlog.views = 1;

  // slugify the urlTitle
  newBlog.urlTitle = slugify(newBlog.urlTitle);

  try {
    const client = new MongoClient(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();

    const db = client.db("formsData");
    const collection = db.collection("blogs");

    await collection.insertOne(newBlog);
    console.log("the url title after slugify is: " + newBlog.url);
    res.status(201).json(newBlog);

    await client.close();
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Internal Server Error");
  }
});

// GET route to retrieve a single blog by ID -> used in the single blog
app.get("/api/blogs/:id", async (req, res) => {
  const blogId = req.params.id; // Extract the 'id' from the route (ignore urlTitle)
  console.log("Received request for blog ID:", req.params.id); // Check if ID is correct

  try {
    if (!ObjectId.isValid(blogId)) {
      return res.status(400).json({ message: "Invalid blog ID" });
    }

    const client = new MongoClient(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();

    const db = client.db("formsData");
    const collection = db.collection("blogs");

    const blogObjectId = new ObjectId(blogId);
    const blog = await collection.findOne({ _id: blogObjectId });

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    // Increment views count
    await collection.updateOne({ _id: blogObjectId }, { $inc: { views: 1 } });

    res.json(blog);
    await client.close();
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Internal Server Error");
  }
});

// PATCH route to update a blog by ID
app.patch("/api/blogs/:id", async (req, res) => {
  const blogId = req.params.id;
  const blogUpdates = req.body;

  // Validate blogId as a valid ObjectId
  if (!ObjectId.isValid(blogId) || blogId.length !== 24) {
    return res.status(400).json({ message: "Invalid blog ID" });
  }

  try {
    const client = new MongoClient(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();

    const db = client.db("formsData");
    const collection = db.collection("blogs");

    // Check if blog exists first
    const existingBlog = await collection.findOne({
      _id: new ObjectId(blogId),
    });

    if (!existingBlog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    // Proceed with update
    const updatedBlog = await collection.findOneAndUpdate(
      { _id: new ObjectId(blogId) },
      { $set: blogUpdates },
      { returnDocument: "after" } // Use returnDocument instead of returnOriginal
    );

    res.json(updatedBlog.value);

    await client.close();
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Internal Server Error");
  }
});

// DELETE route to delete a blog by ID
app.delete("/api/delete/blogs/:id", async (req, res) => {
  const blogId = req.params.id; // Corrected to access req.params.id

  // Validate blogId as a valid ObjectId
  if (!ObjectId.isValid(blogId) || blogId.length !== 24) {
    return res.status(400).json({ message: "Invalid blog ID" });
  }

  try {
    const client = new MongoClient(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();

    const db = client.db("formsData");
    const collection = db.collection("blogs");

    const result = await collection.deleteOne({ _id: new ObjectId(blogId) }); // Use ObjectId for _id
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Blog not found" });
    }
    res.status(204).send("OK");

    await client.close();
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Internal Server Error");
  }
});

// ------------------------------- press release ----------------------------------------------------------

//  POST a new press
app.post("/api/press", async (req, res) => {
  const newPress = req.body;
  newPress.date = getCurrentDate();

  // slugify urlTitle
  newPress.urlTitle = slugify(newPress.urlTitle);

  try {
    const client = new MongoClient(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();

    const db = client.db("formsData");
    const collection = db.collection("Press Releases");

    await collection.insertOne(newPress);
    res.status(201).json(newPress);

    await client.close();
  } catch (err) {
    console.error("Error: ", err);
    res.status(500).send("Internal Server Error");
  }
});

// GET all the press in descending order
app.get("/api/press", async (req, res) => {
  console.log("inside the get press function");
  try {
    const client = new MongoClient(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await client.connect();

    const db = client.db("formsData");
    const collection = db.collection("Press Releases");

    // sort in descending order
    const blogs = await collection
      .find({})
      .sort({
        _id: -1,
      })
      .toArray();

    res.json(blogs);

    await client.close();
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).send("Internal Server Error");
  }
});

// GET press by id
app.get("/api/press/:id", async (req, res) => {
  const pressId = req.params.id;

  try {
    if (!ObjectId.isValid(pressId)) {
      return res.status(400).json({
        message: "Invalid Press Id",
      });
    }

    const client = new MongoClient(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await client.connect();

    const db = client.db("formsData");
    const collection = db.collection("Press Releases");

    const pressObjectId = new ObjectId(pressId);
    const press = await collection.findOne({ _id: pressObjectId });

    if (!press) {
      return res.status(404).json({
        message: "Press not found",
      });
    }

    res.json(press);
    await client.close();
  } catch (err) {
    console.error("Error: ", err);
    res.status(500).send("Internal Server Error");
  }
});

// EDIT press
app.patch("/api/press/:id", async (req, res) => {
  console.log("inside the edit option");

  const pressId = req.params.id;
  const pressUpdate = req.body;

  // validate pressId as a valid objectId
  if (!ObjectId.isValid(pressId) || pressId.length !== 24) {
    return res.status(400).json({
      message: "Invalid Press Id",
    });
  }

  try {
    const client = new MongoClient(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await client.connect();

    const db = client.db("formsData");
    const collection = db.collection("Press Releases");

    // check if existing press increase
    const existingPress = await collection.findOne({
      _id: new ObjectId(pressId),
    });

    if (!existingPress) {
      return res.status(404).json({
        message: "Press not Found",
      });
    }

    // Proceed with an update
    const updatedPress = await collection.findOneAndUpdate(
      { _id: new ObjectId(pressId) },
      { $set: pressUpdate },
      { returnDocument: "after" } // use return document instead of returnOrg
    );

    res.json(updatedPress.value);

    await client.close();
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Delete press
app.delete("/api/delete/press/:id", async (req, res) => {
  const pressId = req.params.id;

  // Validate blogId as vaid ObjectId
  if (!ObjectId.isValid(pressId) || pressId.length != 24) {
    return res.status(400).json({
      message: "Invalid Press Id",
    });
  }

  try {
    const client = new MongoClient(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await client.connect();

    const db = client.db("formsData");
    const collection = db.collection("Press Releases");

    const result = await collection.deleteOne({
      _id: new ObjectId(pressId),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        message: "Press not found",
      });
    }

    res.status(200).send("Ok");
    await client.close();
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).send("Internal Server Error");
  }
});

// ------------------------------- teachers ----------------------------------------------------------

// getting teachers - webite
app.get("/teachers", (req, res) => {
  fs.readFile(path.join(__dirname, "db.json"), "utf8", (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      res.status(500).send("Error reading data file");
    } else {
      res.json(JSON.parse(data));
    }
  });
});

// filtering of teacher - website
app.get("/filterteachers", (req, res) => {
  fs.readFile(path.join(__dirname, "db.json"), "utf8", (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      res.status(500).send("Error reading data file");
    } else {
      try {
        const jsonData = JSON.parse(data);
        const { language, native } = req.query;

        // Filter teachers based on query parameters
        let filteredTeachers = jsonData.teacher;

        if (language && language.toLowerCase() !== "none") {
          filteredTeachers = filteredTeachers.filter(
            (teacher) =>
              teacher.language.toLowerCase() === language.toLowerCase()
          );
        }

        if (native && native.toLowerCase() !== "none") {
          filteredTeachers = filteredTeachers.filter(
            (teacher) => teacher.native.toLowerCase() === native.toLowerCase()
          );
        }

        res.json({
          teachers: filteredTeachers,
        });
      } catch (parseError) {
        console.error("Error parsing JSON:", parseError);
        res.status(500).send("Error parsing JSON data");
      }
    }
  });
});

// patch api for teachers for updating remarks
app.patch("/api/teachers/:id", async (req, res) => {
  const updates = req.body;
  const id = req.params.id;

  // Check if the provided ID is valid
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  try {
    const client = new MongoClient(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await client.connect();
    const db = client.db("formsData");
    const collection = db.collection("teacherData");

    // Instantiate ObjectId with `new` when using it to construct query
    const result = await collection.updateOne(
      { _id: new ObjectId(id) }, // Correct usage of ObjectId with 'new'
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "No matching document found" });
    }

    if (result.modifiedCount === 0) {
      return res
        .status(200)
        .json({ message: "No changes made", details: result });
    }

    res.status(200).json({ message: "Update successful", details: result });
  } catch (err) {
    console.error("Database update error:", err);
    res
      .status(500)
      .json({ error: "Could not update the data", details: err.message });
  }
});

// get all api for teachers data -> admin panel
app.get("/api/teachers", async (req, res) => {
  const client = new MongoClient(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    await client.connect();
    const db = client.db("formsData");
    const collection = db.collection("teacherData");

    const teachers = await collection.find({}).toArray(); // Fetch all blog documents
    res.json(teachers);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Internal Server Error");
  } finally {
    await client.close();
  }
});

app.post(
  "/submit_form",
  upload.fields([
    { name: "uploadPhoto", maxCount: 1 },
    { name: "uploadCV", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const formData = req.body;
      const files = req.files;
      let imageUrl, cvUrl;

      if (!files.uploadPhoto || !files.uploadCV) {
        // return res.status(400).send('Both photo and CV files need to be uploaded.');
      }

      // Construct file base name using firstName and lastName
      const baseName = `${formData.firstName}_${formData.lastName}`.replace(
        / /g,
        "_"
      );

      // Upload photo to Cloudinary
      if (files.uploadPhoto) {
        const photo = files.uploadPhoto[0];
        const cloudinaryUploadPhotoResult = await cloudinary.uploader.upload(
          photo.path,
          { public_id: `photo_${baseName}` }
        );
        imageUrl = cloudinaryUploadPhotoResult.url;
      }

      // Upload CV to Cloudinary
      if (files.uploadCV) {
        const cv = files.uploadCV[0];
        const cloudinaryUploadCVResult = await cloudinary.uploader.upload(
          cv.path,
          { resource_type: "raw", public_id: `cv_${baseName}` }
        );
        cvUrl = cloudinaryUploadCVResult.url;
      }

      const client = new MongoClient(mongoURI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });

      await client.connect();
      const db = client.db("formsData");
      const collection = db.collection("teacherData");

      // Prepare data to be saved
      const dataToSave = {
        date: new Date(),
        ...formData,
        uploadPhoto: imageUrl,
        uploadCV: cvUrl,
        remarks: "",
      };

      await collection.insertOne(dataToSave);
      res.status(200).send("OK");
    } catch (err) {
      console.error("Error:", err);
      res.status(500).send("Internal Server Error");
    }
  }
);

// ------------------------------- marketing leads ----------------------------------------------------------

// Nodemailer configuration for sending email using your custom email
const transporter = nodemailer.createTransport({
  // qurocity account
  // host: "smtp.gmail.com",
  service: "gmail",
  secure: true,
  port: 465,
  auth: {
    user: "qurocityai@gmail.com",
    pass: "nxggfjxoopmqkoqh",
    // pass: "nxgg fjxo opmq koqh"
  },

  // host: "smtp.ethereal.email",
  // auth: {
  //   user: "johnny.gleichner15@ethereal.email",
  //   pass: "DcT9EBjEDFEvP8k8tF",
  // },
});

// for verifying if transporter has access to our gmail
transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP connection error:", error);
  } else {
    console.log("Server is ready to take our messages:", success);
  }
});

// follow up email after submitting the inquiry and counselling form
async function sendFollowUpEmail(formData) {
  const { name, email, contactNumber, language, message, category } = formData;

  // Default message if not provided
  const formattedMessage = message || "Connection Request";

  // Check if languages is an array, else provide a fallback
  const formattedLanguages =
    Array.isArray(language) && language.length > 0
      ? language.join(", ")
      : "No languages specified"; // Fallback if languages are undefined or empty

  // Construct the email options
  const mailOptions = {
    from: "qurocityai@gmail.com",
    to: "partner@qurocity.ai",
    subject: "Inquiry Collected",
    text: `A new inquiry has been collected with the following details:

    Name: ${name}
    Email: ${email}
    Phone: ${contactNumber || "Not provided"}
    Languages: ${formattedLanguages}
    Message: ${formattedMessage}
    Category: ${category}
    `,
  };

  try {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log("Error sending email: ", error.response);
        return res
          .status(500)
          .json({ message: "Error sending email", error: error.response });
      } else {
        console.log("Email sent: " + info.response);
        return res.status(200).json({});
      }
    });

    console.log("Follow-up email sent successfully");
  } catch (error) {
    console.error("Error sending follow-up email:", error);
  }
}

// Route for popup signup and sending email
app.post("/popup", async (req, res) => {
  const { email } = req.body;

  try {
    const client = new MongoClient(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();

    const db = client.db("formsData");
    const marketingCollection = db.collection("PopupLeads");


    // Function to format date
    const formatDate = (date) => {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
        .format(date)
        .replace(",", "")
        .replace(":", ".");
    };

    // Check if the email already exists
    let existingUser = await marketingCollection.findOne({ email });

    let userId;
    if (existingUser) {
      console.log("User already existed");
      // If email exists, use the existing user ID
      userId = existingUser.userId;
    } else {
      // If email is new, create a unique user ID and store it
      userId = uuidv4();
      await marketingCollection.insertOne({
        email,
        userId,
        category: "marketing",
        createdAt: formatDate(new Date()),
      });
    }

    // Now send the automated email
    const mailOptions = {
      from: "qurocityai@gmail.com",
      to: email,
      bcc: "partner@qurocity.ai",
      subject: "Welcome to Qurocity!",
      html: `
    <div style="font-family: 'Raleway', Arial, sans-serif; color: #00046C; padding: 20px; background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 8px; max-width: 600px; margin: auto;">
      <h1 style="color: #00046C; text-align: center;">Welcome To Qurocity.ai</h1>
      <p style="font-size: 16px; line-height: 1.6; text-align: center;">
        With Us, No language is hard to learn. With the best tutors and loads of language resources, language learning becomes a piece of cake!
      </p>
      <h2 style="color: #00046C; font-size: 20px; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; text-align: center;">What Are The Language Learning Services That We Offer</h2>
      
      <div style="display: flex; justify-content: space-between; margin: 20px 0; flex-wrap: wrap">
        <div style="width: 45%; text-align: center;">
          <h3 style="color: #00046C; font-size: 18px;">Learn Any Language</h3>
          <p style="font-size: 14px;">At ₹1499 with the best resources available. Apply Coupon code and get a discount!</p>
          <div style="text-align: center; margin-top: 10px;">
            <a href="https://play.google.com/store/apps/details?id=stage.curiotory.com&pcampaignid=web_share" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #4CAF50; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Download Our App
            </a>
          </div>
        </div>

        <div style="width: 45%; text-align: center;">
          <h3 style="color: #00046C; font-size: 18px;">Confused about which language to learn?</h3>
          <p style="font-size: 14px;">Don’t Worry, get your personalized language session here for absolutely free. Get all the career guidance you need.</p>
          <div style="text-align: center; margin-top: 10px;">
            <a href="https://qurocity.ai/inquiry?userId=${userId}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #FFA726; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Fill Out Your Inquiry
            </a>
          </div>
        </div>
      </div>

      <p style="font-size: 14px; color: #999; text-align: center; margin-top: 30px;">
        Happy Learning!<br>
        Team Qurocity.ai
      </p>

      <p style="font-size: 12px; color: #999; text-align: center; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 20px;">
        <a href="#" target="_blank" rel="noopener noreferrer" style="color: #999; text-decoration: none;">Unsubscribe</a>


      </p>
    </div>
  `,
    };


    // Send email
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
        return res.status(500).json({ message: "Error sending email" });
      }
      console.log("Email sent: " + info.response);
      return res.status(200).json({ userId });
    });

    await client.close();
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// // inquiry form (redirected from an automated email)
app.post("/inquiry", async (req, res) => {
  try {
    const { name, email, phone, languages, message, userId } = req.body;

    const client = new MongoClient(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await client.connect();
    const db = client.db("formsData");
    const marketingCollection = db.collection("MarketingLeads");

    // Function to format date
    const formatDate = (date) => {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
        .format(date)
        .replace(",", "")
        .replace(":", ".");
    };

    let operationResult;

    if (!userId) {
      // Case 1: No userId in the URL, treat as a new entry
      const newEntry = {
        name,
        email,
        phone,
        languages,
        message,
        category: "popup-inquiry",
        createdAt: formatDate(new Date()),
      };

      operationResult = await marketingCollection.insertOne(newEntry);
    } else {
      // Case 2: userId exists, find the existing entry
      const existingEntry = await marketingCollection.findOne({
        userId: userId,
      });

      if (existingEntry) {
        const updateData = {
          name,
          phone,
          languages,
          message,
          updatedAt: formatDate(new Date()),
        };

        // Check if the emails are different
        if (existingEntry.email && existingEntry.email !== email) {
          updateData.popupEmail = existingEntry.email; // Preserve the original email as popupEmail
          updateData.inquiryEmail = email; // Store the new inquiry email
        } else {
          updateData.email = email; // If emails match, just update
        }

        await marketingCollection.updateOne(
          { userId: userId },
          { $set: updateData }
        );
      } else {
        const newEntryWithUserId = {
          userId,
          name,
          email,
          phone,
          languages,
          message,
          category: "popup-inquiry",
          createdAt: formatDate(new Date()),
        };

        operationResult = await marketingCollection.insertOne(
          newEntryWithUserId
        );
      }
    }

    // Send follow-up email after successful database operation
    const formData = {
      name,
      email,
      contactNumber: phone, // Rename 'phone' to 'contactNumber' for email function
      language: languages, // Rename 'languages' to 'language' for email function
      message,
      category: "inquiry", // Add category to track the type of form
    };

    await sendFollowUpEmail(formData); // Pass formData to the email function

    res.status(200).json({
      message: "Form Submitted Successfully",
      entryId: operationResult?.insertedId,
    });
  } catch (error) {
    console.error("Error processing inquiry:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Counseling form submission -> present on the website
app.post("/counseling", async (req, res) => {
  const formData = req.body;

  try {
    const client = new MongoClient(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();

    const db = client.db("formsData");
    const marketingCollection = db.collection("MarketingLeads");

    // Function to format date
    const formatDate = (date) => {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
        .format(date)
        .replace(",", "")
        .replace(":", ".");
    };

    // Check if an entry already exists for this email
    const existingUser = await marketingCollection.findOne({
      email: formData.email,
    });

    if (existingUser) {
      // Scenario 1: Same Email Used
      await marketingCollection.updateOne(
        { email: formData.email },
        {
          $set: {
            name: formData.name || existingUser.name,
            contactNumber: formData.contactNumber || existingUser.contactNumber,
            language: formData.language || existingUser.language,
            category: "counseling",
            updatedAt: formatDate(new Date()), // Format updatedAt
          },
        }
      );

      // Send follow-up email after successful database operation
      await sendFollowUpEmail(formData);

      res.status(200).json({ message: "Form Submitted!" });
    } else {
      // Scenario 2: Different Email Used or new entry
      await marketingCollection.insertOne({
        ...formData,
        category: "counseling",
        createdAt: formatDate(new Date()), // Format createdAt
      });

      // Send follow-up email after successful database operation
      await sendFollowUpEmail(formData);

      res.status(200).json({ message: "Form Submitted!" });
    }

    await client.close();
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// downloading the leads
app.get("/download-leads", async (req, res) => {
  try {
    const client = new MongoClient(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();

    const db = client.db("formsData");
    const marketingCollection = db.collection("MarketingLeads");

    const leads = await marketingCollection.find({}).toArray();

    // Create a new Excel workbook
    const workbook = new excelJS.Workbook();
    const worksheet = workbook.addWorksheet("Marketing Leads");

    // Define columns
    worksheet.columns = [
      { header: "Name", key: "name", width: 25 },
      { header: "Email", key: "email", width: 25 },
      { header: "Phone", key: "contactNumber", width: 20 },
      { header: "Languages", key: "language", width: 30 },
      { header: "Category", key: "category", width: 20 },
      { header: "Created At", key: "createdAt", width: 20 },
    ];

    // Add rows
    leads.forEach((lead) => {
      worksheet.addRow(lead);
    });

    // Set response headers for download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=leads.xlsx");

    // Send the Excel file
    await workbook.xlsx.write(res);
    res.status(200).end();
    await client.close();
  } catch (err) {
    console.error("Error generating Excel file", err);
    res.status(500).send("Error generating Excel file");
  }
});

// ------------------------------- website's forms ----------------------------------------------------------

// account-deletion
app.post("/account", async (req, res) => {
  const formData = req.body;

  try {
    const client = new MongoClient(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();

    const db = client.db("formsData");
    const collection1 = db.collection("accountDeletionRequests");

    await collection1.insertOne(formData);
    res
      .status(200)
      .json({ message: "Account deletion request submitted successfully!" });

    await client.close();
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// post for contact
app.post("/sendMsg", async (req, res) => {
  const formData = req.body;

  try {
    const client = new MongoClient(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();

    const db = client.db("formsData");
    const collection1 = db.collection("contactData");

    await collection1.insertOne(formData);
    res.status(200).json({ message: "Form submitted successfully!" });

    await client.close();
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// enrolling
app.post("/enroll", async (req, res) => {
  const formData = req.body;

  try {
    const client = new MongoClient(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();

    const db = client.db("formsData");
    const collection3 = db.collection("quickForm");

    await collection3.insertOne(formData);
    res.status(200).send("OK");
    await client.close();
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Internal Server Error");
  }
});

// guideform
app.post("/guideForm", async (req, res) => {
  const formData = req.body;

  try {
    const client = new MongoClient(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();

    const db = client.db("formsData");
    const collection4 = db.collection("guideData");

    await collection4.insertOne(formData);
    res.status(200).send("OK");

    await client.close();
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Internal Server Error");
  }
});
// owner is: org github