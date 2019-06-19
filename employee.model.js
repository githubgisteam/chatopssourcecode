
var mongoose = require("mongoose");
const Schema = mongoose.Schema;
const employeeSchema = new Schema({
    name: String,
    leave_type : String,
    start_date : String,
    end_date : String,
    desc : String,
    empid : Number,
    cur_date : String,
    leave_status : String
})
module.exports = mongoose.model('emp_leave',employeeSchema)