require("dotenv").config()
const {Pool}=require("pg")



const pool= new Pool({
    connectionString:process.env.DATABASE_URL
})

const connectDB =async()=>{
    try{
        await pool.query("SELECT 1")
        console.log("db connected")
    }catch(err){
        console.log("db connection err:",err.message)
        process.exit(1)
    }
}

module.exports= {connectDB,pool}