const express = require("express");
const app = express();
const cors = require('cors');
const mongodb = require("mongodb");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoClient = mongodb.MongoClient;
const dotenv = require("dotenv")
dotenv.config();
// const url = "mongodb+srv://vasanth:admin123@cluster0.9v1ks.mongodb.net?retryWrites=true&w=majority";
const url = process.env.DB;
const PORT = process.env.PORT || 3001;
app.use(cors({
    origin: "*"
}))
const nodemailer = require("nodemailer")

app.use(express.json());

function authenticate(req, res, next) {
    try {
    // Check if the token is present
    // if present -> check if it is valid
    if(req.headers.authorization){
        jwt.verify(req.headers.authorization,process.env.JWT_SECRET,function(error,decoded){
            if(error){
                res.status(500).json({
                    message: "Unauthorized"
                })
            }else{
                // console.log(decoded)
                req.userid = decoded.id;
                next()
            }
            
        });
      
    }else{
        res.status(401).json({
            message: "No Token Present"
        })
    }
    } catch (error) {
        console.log(error)
        res.status(500).json({
            message: "Internal Server Error"
        })
    }
    
}

// let tasks = []
app.get("/confirm/:token",async function(req,res){
    try {
        jwt.verify(req.params.token,process.env.JWT_SECRET,async function(error,decoded){
            let client = await mongoClient.connect(url)
            let db = client.db("loginuser");
            let user = await db.collection("users").findOne({_id:mongodb.ObjectId(decoded.id)});
           
            if(user){
                await db.collection("users").findOneAndUpdate({_id:mongodb.ObjectId(decoded.id)},{$set:{verified:true}});
                res.json({
                    message:"Email confirmed"
                })
            }            
            else{
                res.json({
                    message:"Wrong token"
                })
            }
        })
    } catch (error) {
        res.json({
            err
        })
    }
})
app.get("/confirm-admin/:token",async function(req,res){
    try {
        jwt.verify(req.params.token,process.env.JWT_SECRET,async function(error,decoded){
            let client = await mongoClient.connect(url)
            let db = client.db("loginadmin");
            let user = await db.collection("admins").findOne({_id:mongodb.ObjectId(decoded.id)});
           
            if(user){
                await db.collection("admins").findOneAndUpdate({_id:mongodb.ObjectId(decoded.id)},{$set:{verified:true}});
                res.json({
                    message:"Email confirmed"
                })
            }            
            else{
                res.json({
                    message:"Wrong token"
                })
            }
        })
    } catch (error) {
        res.json({
            err
        })
    }
})
app.post("/register", async function (req, res) {
    try {
        // Connect the Database
        let client = await mongoClient.connect(url)

        // Select the DB
        let db = client.db("loginuser");

        // Hash the password
        let salt = bcryptjs.genSaltSync(10);
        let hash = bcryptjs.hashSync(req.body.password, salt)
        req.body.password = hash;
        req.body.verified=false;
        let email = await db.collection("users").findOne({username:req.body.username});
        if(email){
            res.json({
                message:"User already Exists!"
            })
        }
        // Select the Collection and perform the action
        else{
            let data = await db.collection("users").insertOne(req.body)
            await client.close();
            let token = jwt.sign({ id: data.insertedId }, process.env.JWT_SECRET)
            let transporter = nodemailer.createTransport({
                service:"Gmail",
                auth: {
                  user: process.env.user, 
                  pass: process.env.pass,
                }})
                let url = `${process.env.host}/confirm/${token}`
                await transporter.sendMail({
                from:process.env.user,
                to:req.body.username,
                subject:"Confirm Email!",
                html:`<h1>Hey there!</h1>
                Verify your account for User in Movie Booking App: <a href=${url}>${url}</a>`
            })
            console.log("Email sent")
            res.json({
                message: "Confirmation Email Sent",
                id: data._id
            })
        }            
        // Close the Connection
        await client.close();

        res.json({
            message: "User Registered",
            id: data._id
        })
    } catch (error) {

    }
})
app.post("/register-admin", async function (req, res) {
    try {
        // Connect the Database
        let client = await mongoClient.connect(url)

        // Select the DB
        let db = client.db("loginadmin");

        // Hash the password
        let salt = bcryptjs.genSaltSync(10);
        let hash = bcryptjs.hashSync(req.body.password, salt)
        req.body.password = hash;
        req.body.verified=false;
        // Select the Collection and perform the action
        let email = await db.collection("admins").findOne({username:req.body.username});

        // Close the Connection
        if(email){
            await client.close();
            console.log("Admin Exists")
            res.json({
                message:"Admin already exists"
            })
        }
        else{
            let data = await db.collection("admins").insertOne(req.body)
            // Close the Connection
            await client.close();
            let token = jwt.sign({ id: data.insertedId }, process.env.JWT_SECRET)
            // console.log(data.insertedId)
            let transporter = nodemailer.createTransport({
                service:"Gmail",
                auth: {
                  user: process.env.user, 
                  pass: process.env.pass,
                }})
                let url = `${process.env.host}/confirm-admin/${token}`
                await transporter.sendMail({
                from:process.env.user,
                to:req.body.username,
                subject:"Confirm Email!",
                html:`<h1>Hey there!</h1>
                Verify your account for Admin in Movie Booking App: <a href=${url}>${url}</a>`
            })
            console.log("Email sent")
            res.json({
                message: "Confirmation Email Sent",
                id: data._id
            })}
        // res.json({
        //     message: "User Registered",
        //     id: data._id
        // })
    } catch (error) {
        res.status(400).json({
            message:"Uncaught Error Occured",
            error
        })
    }
})
app.post("/login", async function (req, res) {
    try {
        // Connect the Database
        let client = await mongoClient.connect(url)

        // Select the DB
        let db = client.db("loginuser");

        // Find the user with email_id
        let user = await db.collection("users").findOne({ username: req.body.username });

        if (user && user.verified) {
            // Hash the incoming password
            // Compare that password with user's password
            console.log(req.body)
            console.log(user.password)
            let matchPassword = bcryptjs.compareSync(req.body.password, user.password)
            if (matchPassword) {
                // Generate JWT token
                let token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)
                res.json({
                    message: true,
                    token
                })
            } else {
                res.status(404).json({
                    message: "Username/Password is incorrect"
                })
            }
            // if both are correct then allow them
        } else {
            res.status(404).json({
                message: "User not registered or may not have verfied"
            })
        }
    } catch (error) {
        console.log(error)
    }
})
app.post("/login-admin", async function (req, res) {
    try {
        // Connect the Database
        let client = await mongoClient.connect(url)

        // Select the DB
        let db = client.db("loginadmin");

        // Find the user with email_id
        let user = await db.collection("admins").findOne({ username: req.body.username });

        if (user.verified) {
            // Hash the incoming password
            // Compare that password with user's password
            console.log(req.body)
            console.log(user.password)
            let matchPassword = bcryptjs.compareSync(req.body.password, user.password)
            if (matchPassword) {
                // Generate JWT token
                let token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)
                res.json({
                    message: true,
                    token
                })
            } else {
                res.status(404).json({
                    message: "Username/Password is incorrect"
                })
            }
            // if both are correct then allow them
        } else {
            res.status(404).json({
                message: "Username/Password is incorrect"
            })
        }
    } catch (error) {
        console.log(error)
    }
})
app.post("/addtheatre",[authenticate], async function (req, res) {
    try {
        // Connect the Database
        let client = await mongoClient.connect(url)

        // Select the DB
        let db = client.db("loginadmin");

        // Find the user with email_id
        req.body.adminid = req.userid;
        let data = await db.collection("admins_theatres").insertOne(req.body);

        await client.close();

        res.json({
            message: "Theatre Added",
            // id: data._id
        })
    } catch (error) {
        console.log(error)
    }
})
app.get("/theatres",[authenticate], async function (req, res) {
    try {
        // Connect the Database
        let client = await mongoClient.connect(url)

        // Select the DB
        let db = client.db("loginadmin");

        // Select the collection and perform action
        let data = await db.collection("admins_theatres").find({adminid : req.userid}).toArray();

        // Close the Connection
        client.close();

        res.json(data)
    } catch (error) {
        res.status(500).json({
            message: "Something went wrong"
        })
    }
})
app.delete("/remove-theatre/:id",[authenticate], async function (req, res) {
    try {
        // Connect the Database
        let client = await mongoClient.connect(url)

        // Select the DB
        let db = client.db("loginadmin")

        // Select the Collection and perform the action
        let data = await db.collection("admins_theatres")
            .findOneAndDelete({ _id: mongodb.ObjectId(req.params.id) })

        // Close the Connection
        await client.close();

        res.json({
            message: "Theatre Deleted"
        })
    } catch (error) {
        res.status(500).json({
            message: "Something Went Wrong"
        })
    }
})
app.post("/addshow/:id",[authenticate],async function(req,res){
     // Connect the Database
    try{ let client = await mongoClient.connect(url)

     // Select the DB
     let db = client.db("loginadmin")

     // Select the Collection and perform the action
     req.body.adminid = req.userid;
     req.body.theatre = req.params.id
        console.log(req.body)
        let data = await db.collection("theatre_shows").insertOne(req.body)
        // let data = await db.collection("theatre_shows").insertMany()
        // let data2 = await db.collection("seats").insertMany()
     // Close the Connection
     await client.close();

     res.json({
         message: "Movie Added"
     })
 } catch (error) {
     res.status(500).json({
         message: "Something Went Wrong"
     })
    }
})
app.get("/movies/:id",[authenticate], async function(req,res){
    try{
         let client = await mongoClient.connect(url)

        // Select the DB
        let db = client.db("loginadmin")
   
        // Select the Collection and perform the action
       
           let data = await db.collection("theatre_shows").find({adminid : req.userid,theatre:req.params.id}).toArray();
        // Close the Connection
        await client.close();
   
        res.json(data)
    } catch (error) {
        res.status(500).json({
            message: "Something Went Wrong"
        })
       }
})
app.delete("/remove-movie/:id",[authenticate], async function (req, res) {
    try {
        // Connect the Database
        let client = await mongoClient.connect(url)

        // Select the DB
        let db = client.db("loginadmin")

        // Select the Collection and perform the action
        let data = await db.collection("theatre_shows")
            .findOneAndDelete({ _id: mongodb.ObjectId(req.params.id) })

        // Close the Connection
        await client.close();

        res.json({
            message: "Movie Deleted"
        })
    } catch (error) {
        res.status(500).json({
            message: "Something Went Wrong"
        })
    }
})
app.get("/listmovies", async function(req,res){
    try{
         let client = await mongoClient.connect(url)

        // Select the DB
        let db = client.db("loginadmin")
   
        // Select the Collection and perform the action
       
           let data = await db.collection("theatre_shows").find({},{"name":1,"_id":1}).toArray()
           let data2 = await db.collection("admins_theatres").find().toArray()

        // Close the Connection
        await client.close();
   
        res.json([data,data2])
    } catch (error) {
        res.status(500).json({
            message: "Something Went Wrong"
        })
       }
})
app.get("/seats/:id",[authenticate], async function(req,res){
    try{
         let client = await mongoClient.connect(url)

        // Select the DB
        let db = client.db("loginadmin")
   
        // Select the Collection and perform the action
        // console.log(req.params.id)
           let data = await db.collection("theatre_shows").find({},{_id:req.params.id}).toArray()
        // Close the Connection
        // console.log(req.userid)
        data[0].userid = req.userid
        await client.close();
        // console.log(data)
        res.json(data)
    } catch (error) {
        console.log(error)
        res.status(500).json({
            message: "Something Went Wrong"
        })
       }
})
app.put("/seatbooked/:id",[authenticate], async function(req,res){
    try {
        let client = await mongoClient.connect(url)
        let db = client.db("loginadmin")
        let db2 = client.db("loginuser")
        // let data = await db.collection("theatre_shows").findOneAndUpdate({_id:mongodb.ObjectId(req.params.id)},{$set:{"seats.$[elem].status":req.body.status,"seats.$[elem].statusid":req.body.statusid}},{ arrayFilters: [ { "elem.row": req.body.row,"elem._id": req.body._id }] });
      
        await db.collection("theatre_shows").updateMany({_id:mongodb.ObjectId(req.params.id)},{$set:{"seats.$[elem].booked":true,"seats.$[elem].bookedid":req.body.userid}},{ arrayFilters: [ { "elem.status":true,"elem.statusid": req.body.userid } ]})
        // let data = await db.collection("theatre_shows").  
        let data= await db.collection("theatre_shows").find({_id:mongodb.ObjectId(req.params.id)}).toArray();
        let theatre = await db.collection("admins_theatres").findOne({_id:data[0].theatre})
        let result = data[0].seats.filter((obj)=>obj.booked==true&&obj.bookedid==req.userid);
        let email = await db2.collection("users").find({_id:mongodb.ObjectId(req.userid)},{username:1}).toArray()
        await client.close()
        console.log(result,email)
        res.json({data,email})
        let transporter = nodemailer.createTransport({
            service:"Gmail",
            auth: {
              user: process.env.user, 
              pass: process.env.pass,
            }})
            
            await transporter.sendMail({
                from:process.env.user,
                to:email[0].username,
                subject:"Booked Tickets",
                html:`<h1>Hey find your tickets</h1>
                Your booked tickets details <br/>
            <h3>Movie Name:${data[0].moviename},<br/>
            Movie Time:${data[0].time},<br/>
            Theatre: ${theatre},<br/><h3>
            Seats:${result.map(obj=>{return(`Row ${obj.row}-Seat ${obj._id}`)})}<br/>`})
    } catch (error) {
        console.log(error)
        res.json(error)
    }
})
app.put("/seatbook/:id",[authenticate],async function(req,res){
    try{
        let client = await mongoClient.connect(url)

       // Select the DB
       let db = client.db("loginadmin")
  
       // Select the Collection and perform the action
       // console.log(req.params.id)
       if(req.body.status){
           req.body.statusid=req.userid;
       }
       else{
           req.body.statusid=0
       }
          let data = await db.collection("theatre_shows").findOneAndUpdate({_id:mongodb.ObjectId(req.params.id)},{$set:{"seats.$[elem].status":req.body.status,"seats.$[elem].statusid":req.body.statusid}},{ arrayFilters: [ { "elem.row": req.body.row,"elem._id": req.body._id }] });
          console.log(data)
       // Close the Connection
       await client.close();
  
       res.json(data)
   } catch (error) {
       console.log(error)
       res.status(500).json({
           message: "Something Went Wrong"
       })
    }
})


app.listen(PORT, function () {
    console.log(`The app is listening in port ${PORT}`)
})