/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for
 * license information.
 */

var express = require('express');
var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json());
var mongoose = require('mongoose');
var leaveModel = require('./employee.model');


app.use('/public', express.static(__dirname + "/public"));
app.get('/', function (req, res) {
    res.set({
        'Access-Control-Allow-Origin': '*' 
    });
    return res.redirect('public/login.html')
});

/**set port using env variable for server */
 var port = process.env.PORT || 3000;
	app.listen(port, "0.0.0.0", function () {
		console.log("Listening on --- Port 3000");
});

/**set port using env variable  for local*/
 /* 
var server = app.listen(3000, function () {
  var host = server.address().address
  var port = server.address().port
  console.log("Example app listening at http://%s:%s", host, port)
})*/

/**pass incoming webhook to send messege to slack from azure */
var MY_SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/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";
var slack = require('slack-notify')(MY_SLACK_WEBHOOK_URL);


var util = require('util');
//var async = require('async');
var msRestAzure = require('ms-rest-azure');
var ComputeManagementClient = require('azure-arm-compute');
var StorageManagementClient = require('azure-arm-storage');
var NetworkManagementClient = require('azure-arm-network');
var ResourceManagementClient = require('azure-arm-resource').ResourceManagementClient;


_validateEnvironmentVariables();
var clientId = process.env['CLIENT_ID'];
var domain = process.env['DOMAIN'];
var secret = process.env['APPLICATION_SECRET'];
var subscriptionId = process.env['AZURE_SUBSCRIPTION_ID'];

console.log( "client",clientId);
console.log("secreat",secret);
console.log("domain",domain);
console.log("subc",subscriptionId);

var resourceClient, computeClient, storageClient, networkClient;
//Sample Config
var randomIds = {};
var location = 'westus';
var accType = 'Standard_LRS';

// Ubuntu config
var publisher = 'Canonical';
var offer = 'UbuntuServer';
var sku = '14.04.3-LTS';
var osType = 'Linux';
var adminUsername = 'notadmin';
var adminPassword = 'Pa$$w0rd92';

var domainNameLabel = _generateRandomId('testdomainname', randomIds);
var ipConfigName = _generateRandomId('testcrpip', randomIds);
var osDiskName = _generateRandomId('testosdisk', randomIds);

/** start connection  from servicenow*/
const sn = require('servicenow-rest-api');
const ServiceNow = new sn('dev49606', 'admin', '10Service@321');
/** end connection  from servicenow*/

/** start connection from mongodb */
mongoose.connect("mongodb://admin:admin123@ds235850.mlab.com:35850/leave_management", { useNewUrlParser: true }).then(
    (res) => {
        console.log("Connected to Database Successfully.");
    }
).catch(() => {
    console.log("Conntection to database failed.");
});
/** End connection from mongodb */


/**Start Print system date using javascript*/
function getsystemdate() {
    now = new Date();
    year = "" + now.getFullYear();
    month = "" + (now.getMonth() + 1);

    if (month.length == 1) {
        month = "0" + month;
    }
    day = "" + now.getDate();
    if (day.length == 1) {
        day = "0" + day;
    }
    hour = "" + now.getHours();
    if (hour.length == 1) {
        hour = "0" + hour;
    }
    minute = "" + now.getMinutes();
    if (minute.length == 1) {
        minute = "0" + minute;
    }
    second = "" + now.getSeconds();
    if (second.length == 1) {
        second = "0" + second;
    }
    return day + "-" + month + "-" + year + " " + hour + ":" + minute + ":" + second;
}
var currentTime = getsystemdate();


///////////////////////////////////////////
//     API for connection from azure,servicenow ticket and leave management system //
///////////////////////////////////////////
app.post('/azure', function (req, response) {

    msRestAzure.loginWithServicePrincipalSecret(clientId, secret, domain, function (err, credentials, subscriptions) {
        if (err) return console.log(err);
        //console.log(credentials)
        resourceClient = new ResourceManagementClient(credentials, subscriptionId);
        computeClient = new ComputeManagementClient(credentials, subscriptionId);
        storageClient = new StorageManagementClient(credentials, subscriptionId);
        networkClient = new NetworkManagementClient(credentials, subscriptionId);
		 response.setHeader('Content-Type', 'application/json');
		console.log("Display name ", req.body.queryResult.intent.displayName);
        switch (req.body.queryResult.intent.displayName) {			
           case "createresourceonazure":	
				var getResourceName = req.body.queryResult.parameters.resourcename;
                var resourceGroupName = getResourceName.toString();
                createResourceGroup(resourceGroupName, function (err, result) {
                    if (err) {
                        console.log("error in creating resource group",err);
						response.send(JSON.stringify({ "fulfillmentText": "Error in creating resource group" }));
                    } else {
						console.log("Here is result", result.name);
                        //response.send(JSON.stringify({ "fulfillmentText": "Resource group is created successfully with name " +result.name}));						
					slack.send({				  
						channel: 'azure',
						text:  'Resource group is created with name '+result.name		
					}); 

                    }
                 }); 
				break;		
			case "createstorageaccount":
			 response.setHeader('Content-Type', 'application/json');			
				var getResourceName = req.body.queryResult.parameters.resourcename;
                var resourceGroupName = getResourceName.toString();
				var getstorageAccountName = req.body.queryResult.parameters.storageaccountname;
				var storageAccountName = getstorageAccountName.toString();
				createStorageAccount(storageAccountName,resourceGroupName, function (err, storageacc) {
                    if (err) {
						 console.log("error in creating storage acocount", err);
						slack.send({				  
							channel: 'azure',
							text:  "Error in creating Storage account"
					   });  
                       //response.send(JSON.stringify({ "fulfillmentText": "Error in creating storage account" }));
                    } else {
						 console.log("Storage accouint is created",storageacc );
						 //response.send(JSON.stringify({ "fulfillmentText": "Storage account is created successfully with name "}));
					slack.send({				  
						channel: 'azure',
						text:  'Storage account is created with name '+storageacc.name	
					});                         
                    }
					
                });
            break;
			case "createvnet":	
				var getResourceName = req.body.queryResult.parameters.resourcename;
                var resourceGroupName = getResourceName.toString();
				var getvnetName = req.body.queryResult.parameters.vnetname;
				var vnetName = getvnetName.toString();
				var getsubnetName = req.body.queryResult.parameters.subnetname;
                var subnetName = getsubnetName.toString();
                createVnet(resourceGroupName, vnetName, subnetName, function (err, vnetInfo) {
                    if (err) {
						console.log(err)
                        //response.send(JSON.stringify({ "fulfillmentText": "Error in creating virtual network" }));
						slack.send({				  
							channel: 'azure',
							text:  "Error in creating virtual network"
					   }); 
                    } else {	
                        console.log("Vnet is created",vnetInfo );
						//response.send(JSON.stringify({ "fulfillmentText": "Vitual network is created successfully with name " +vnetInfo.name }));
					slack.send({				  
						channel: 'azure',
						text:  'Virtual network is created with name '+vnetInfo.name		
					}); 
                    }
                });
                break;
			case "createpublicip":
                var getResourceName = req.body.queryResult.parameters.resourcename;
                var resourceGroupName = getResourceName.toString();
				var getPublicipName = req.body.queryResult.parameters.publicipname;
                var publicIPName = getPublicipName.toString();
                createPublicIP(resourceGroupName,publicIPName, function (err, publicIPInfo) {
                    if (err) {
                        console.log("error in creating publicip",err);
						slack.send({				  
							channel: 'azure',
							text:  "error in creating publicip"
					   }); 
						// response.send(JSON.stringify({ "fulfillmentText": "Error in creating public ip" }));
                    } else {
                        console.log("PublicIp is created" + util.inspect(publicIPInfo, { depth: null }));
						//response.send(JSON.stringify({ "fulfillmentText": "Public Ip is created successfully with name " +publicIPInfo.name }));
					slack.send({				  
						channel: 'azure',
						text:  'Public ip is created with name '+publicIPInfo.name		
					}); 
                    }
                });
                break;
			case "getSubnetInfo":
                var getResourceName = req.body.queryResult.parameters.resourcename;
                var resourceGroupName = getResourceName.toString();
				var getvnetName = req.body.queryResult.parameters.vnetname;
                var vnetName = getvnetName.toString();
				var getsubnetName = req.body.queryResult.parameters.subnetname;
                var subnetName = getsubnetName.toString();
                getSubnetInfo(resourceGroupName,vnetName,subnetName, function (err, subnetInfo) {
                    if (err) {
						console.log(err)
						slack.send({				  
							channel: 'azure',
							text:  "Error in getting subnet information"
					   }); 
                        //response.send(JSON.stringify({ "fulfillmentText": "To get subnetinfo" }));
                    } else {
                        console.log('\nFound subnet:\n' + util.inspect(subnetInfo, { depth: null }));
						//response.send(JSON.stringify({ "fulfillmentText": "Subnet name is  " +publicIPInfo.name }));
					slack.send({				  
						channel: 'azure',
						text:  "Subnet information...\n 1.Subnet name: " +subnetInfo.name+ "\n 2.Provision state: " +subnetInfo.provisioningState	
					}); 
                    }
                });
                break;
			case "findVMImage":
				findVMImage(function (err, vmImageInfo) {
                    if (err) {
                        console.log("error to fetch vmimage",err);
						slack.send({				  
							channel: 'azure',
							text:  "Error to get vmimage information"
					   }); 
                    } else {
                       console.log('\nFound Vm Image:\n' + util.inspect(vmImageInfo, { depth: null }));	 
						//response.send(JSON.stringify({ "fulfillmentText": "Vm image info here: " +vmImageInfo.name+ " and location is " +vmImageInfo.location}));
					slack.send({				  
						channel: 'azure',
						text:  "Vmimage information...\n 1.vmimage name: " +vmImageInfo[0].name+ "\n 2.ID: " +vmImageInfo[0].id+ "\n 3.Location: "+vmImageInfo[0].location
					});
                    }
                });
                break;
			case "createNIC":
                var getResourceName = req.body.queryResult.parameters.resourcename;
                var resourceGroupName = getResourceName.toString();	
                var getvnetName = req.body.queryResult.parameters.vnetname;
				var vnetName =  getvnetName.toString();
                var getsubnetName = req.body.queryResult.parameters.subnetname;
				var subnetName = getsubnetName.toString();
				var publicIPName = _generateRandomId('testpip', randomIds);				
				var getnetworkInterfaceName = req.body.queryResult.parameters.nicname;
				var networkInterfaceName =  getnetworkInterfaceName.toString();
               
                getSubnetInfo(resourceGroupName,vnetName, subnetName, function (err, subnetInfo) {
                    if (err) { console.log("error in info",err) } else {
                        console.log('\nFound subnet:\n' + util.inspect(subnetInfo, { depth: null }))
                    };
                    createPublicIP(resourceGroupName,publicIPName, function (err, publicIPInfo) {
                        if (err) { console.log("error in info1",err) } else {
                            console.log('\nCreated public IP:\n' + util.inspect(publicIPInfo, { depth: null }))
                        };
                        createNIC(subnetInfo, publicIPInfo, networkInterfaceName, resourceGroupName, function (err, nicInfo) {
                            if (err) {
                                console.log("error in info2",err)
                            } else {
                                //console.log('\nCreated Network Interface:\n' + util.inspect(nicInfo, { depth: null }))							
							 slack.send({				  
								channel: 'azure',
								text: "Created NIC information...\n 1.NIC name: " +nicInfo.name+ "\n 2.NIC type: " +nicInfo.type+ "\n 3.Location: "+nicInfo.location+ "\n 4.Ipconfiguration id "+nicInfo.ipConfigurations[0].id+"\n 5.Subnet id: "+nicInfo.ipConfigurations[0].subnet.id
							});
                            };
                        });
                    }); 
                });
                break;
			case "createvirtualmachine":
                var getResourceName = req.body.queryResult.parameters.resourcename;
                var resourceGroupName = getResourceName.toString();
                var publicIPName = _generateRandomId('testpip', randomIds);
			    var getvnetName = req.body.queryResult.parameters.virtualnetworkname;
                var vnetName = getvnetName.toString();
				var getsubnetName = req.body.queryResult.parameters.subnetname;
                var subnetName = getsubnetName.toString();
				var getstorageAccountName = req.body.queryResult.parameters.storageaccountname;
                var storageAccountName = getstorageAccountName.toString();
                var networkInterfaceName = _generateRandomId('testnic', randomIds);
				var getvmName = req.body.queryResult.parameters.virtualmachinename;
                var vmName = getvmName.toString();
                getSubnetInfo(resourceGroupName, vnetName, subnetName,function (err, subnetInfo) {
                    if (err){console.log("error1", err)} else{ 
                    console.log('\nFound subnet:\n' + util.inspect(subnetInfo, { depth: null }));} 
                    createPublicIP(resourceGroupName,publicIPName,function (err, publicIPInfo) {
                        if (err){console.log("error2", err)} else{ 
                            console.log('\nCreated public IP:\n' + util.inspect	(publicIPInfo, { depth: null }));} 
                      createNIC(subnetInfo, publicIPInfo,networkInterfaceName, resourceGroupName, function (err, nicInfo) {
                        if (err){console.log("error3", err)} else{ 
                            console.log('\nCreated Network Interface:\n' + util.inspect(nicInfo, { depth: null }));} 
                        findVMImage(function (err, vmImageInfo) {
                            if (err){console.log("error4", err)} else{ 
                                console.log('\nFound Vm Image:\n' + util.inspect(vmImageInfo, { depth: null })); }
                             createVirtualMachine(nicInfo.id, vmImageInfo[0].name,resourceGroupName,vmName,storageAccountName, function (err, vmInfo) {
                                if (err){console.log("error5", err)} else{ 
                                   console.log("Created virtual machine information...\n 1.Virtual machine name: " +vmName);
								   slack.send({				  
									channel: 'azure',
									text:  "Virtual machine is created with name " +vmName	
								});
								}
							    
                            });
                          });
                        });
                      });
                    });
            break;
		case "getvirtualmachineinfo":
            var getresourceGroupName = req.body.queryResult.parameters.resourcename;
            var resourceGroupName = getresourceGroupName.toString();
			var getvmName = req.body.queryResult.parameters.virtualmachinename;
            var vmName = getvmName.toString();
            computeClient.virtualMachines.get(resourceGroupName, vmName, function (err, result) {
                if (err) {
                  console.log(util.format('\n???????Error in Task2: while getting the VM Info:\n%s',util.inspect(err, { depth: null })));
				  slack.send({				  
					channel: 'azure',
					text:  'Error in getting virtual machine information'	
				});
                   
                } else {
                console.log(util.format('\n######End of Task2: Get VM Info is successful.\n%s',util.inspect(result, { depth: null })));
					slack.send({				  
						channel: 'azure',
						text:  "Virtual machine information ...\n 1.Virtual machine name: " +result.name+ "\n 2.Type: " +result.type+ "\n 3.Location:"+result.location	
					});
                }
				
              });
            break;
		case "poweroffvirtualmachine":
            var getresourceGroupName = req.body.queryResult.parameters.resourcegroupname;
            var resourceGroupName = getresourceGroupName.toString();
			var getvmName = req.body.queryResult.parameters.virtualmachinename;
            var vmName = getvmName.toString();
            computeClient.virtualMachines.powerOff(resourceGroupName, vmName, function (err, result) {
                if (err) {
					console.log(util.format('\n???????Error in Task3: while powering off the VM:\n%s',util.inspect(err, { depth: null })));
				slack.send({				  
					channel: 'azure',
					text:  'Error in power off virtual machine'
				});
                    
                } else {
                  console.log(util.format('\n######End of Task3: Poweroff the VM is successful.\n%s',util.inspect(result, { depth: null })));
				slack.send({				  
					channel: 'azure',
					text:  'virtual machine is in shut down state '+vmName 
				});
                }
              });
            break;
		case "startvirtualmachine":     
            var getresourceGroupName = req.body.queryResult.parameters.resourcename;
            var resourceGroupName = getresourceGroupName.toString();
			var getvmName = req.body.queryResult.parameters.virtualmachinename;
            var vmName = getvmName.toString();
            computeClient.virtualMachines.start(resourceGroupName, vmName, function (err, result) {
                if (err) {	
					console.log(util.format('\n???????Error in Task4: while starting the VM:\n%s',util.inspect(err, { depth: null })));
				slack.send({				  
					channel: 'azure',
					text:  'Error in start virtual machine'
				});
                } else {
                console.log(util.format('\n######End of Task4: Start the VM is successful.\n%s',util.inspect(result, { depth: null })));
					slack.send({				  
						channel: 'azure',
						text:  'Virtual machine is started '+vmName,
					});
                }
              });
            break;
		case "listallvirtualmachine":        
            computeClient.virtualMachines.listAll(function (err, result) {
                if (err) {
                    console.log(err);
					slack.send({				  
						channel: 'azure',
						text:  "Error in getting to list all virtual machine "
					}); 
                } else {
                  console.log(util.format('\n######End of Task5: List all the vms under the current ' +'subscription is successful.\n%s', util.inspect(result, { depth: null })));
					console.log("Below is list of virtual machine. \n" +result[0].name+ "\n")
				slack.send({				  
					channel: 'azure',
					text: "Virtual machine list ...\n 1.Virtual machine name: " +result[0].name+ " \n2.Type:" +result[0].type+ "\n 3.Location: "+result[0].location
					});
                }
              });
            break;
		/**Create new ticket in service now */
        case "createnewticketservicenow":
            var sort_desc = (req.body.queryResult.parameters.sort_description).toString();
            const data = {
                'short_description': (req.body.queryResult.parameters.sort_description).toString(),
                'urgency': (req.body.queryResult.parameters.urgency).toString(),
                'assignment_group': 'Hardware'
            };
            ServiceNow.createNewTask(data, 'incident', res => {
                console.log(JSON.stringify({ "fulfillmentText": "Your ticket " + res.number + " is created successfully with status: " + res.state + " and description: " + res.short_description }));
                response.send(JSON.stringify({ "fulfillmentText": "Your ticket " + res.number + " is created successfully with status: " + res.state + " and description: " + res.short_description }));
            });

            break;
		/**Getting ticket details from service now */
        case "getServiceNowTkt":
            response.setHeader('Content-Type', 'application/json');
            const fields = [
                'number',
                'short_description',
                'assignment_group',
                'priority',
                'incident_state'
            ];
            const filters = [
                'number=' + req.body.queryResult.parameters.tktnumber
            ];
            ServiceNow.getTableData(fields, filters, 'incident', res => {
		
                console.log(JSON.stringify({ "fulfillmentText": "Ticketnumber: " + res[0].number + " status is " + res[0].incident_state + " and description : " + res[0].short_description }));
                response.send(JSON.stringify({ "fulfillmentText": "Ticketnumber:  " + res[0].number + " status is " + res[0].incident_state + " and description : " + res[0].short_description }));
            });
            break;
			/**Getting ticket urgency from service now */
			 case "geturgencyofticket":
				response.setHeader('Content-Type', 'application/json');
				const fieldsarray = [
					'number',
					'urgency'             
				];
				const filtersarray = [
					'number=' + req.body.queryResult.parameters.ticketnumber
				];
            ServiceNow.getTableData(fieldsarray, filtersarray, 'incident', res => {
                console.log("data is here", res);
                var result = res[0].urgency;
                var data = result.split("-", -1);
                var urgencydata = data[1];
                console.log(JSON.stringify({ "fulfillmentText": "Ticketnumber: " + res[0].number + " urgeny is " +urgencydata }));
                response.send(JSON.stringify({ "fulfillmentText": "Ticketnumber: " + res[0].number + " urgeny is " +urgencydata }));
            });
            break;
			    break;
        /**Update ticket status in service now */
        case "updateservicenowticket":
            var status = (req.body.queryResult.parameters.ticket_status).toString();
		     var ticketnuber = (req.body.queryResult.parameters.ticket_number).toString();			  
            /**change status in first charater in uppercase */
            function toTitleCase(str) {
                return str.replace(/\w\S*/g, function (txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
            }
			
            var newstatus = toTitleCase(status);
				console.log("hii",newstatus)
            const updatedata = {
                'incident_state': newstatus
            };
            ServiceNow.UpdateTask('incident',ticketnuber,updatedata, res => {
                response.setHeader("Content-Type", "application/json");
				response.send(JSON.stringify({ "fulfillmentText": "Your ticket number: " + ticketnuber + " is updated successfully with status " + newstatus }));
				
				/*  if (res = "undefined") {
                    console.log("Unable to process your request")
                    response.send(JSON.stringify({ "fulfillmentText": "Unable to process your request"}));
                } else {
					console.log(JSON.stringify({ "fulfillmentText": "Your ticket number: " + req.body.queryResult.parameters.ticket_number + " is updated successfully with status " + newstatus }));
					response.send(JSON.stringify({ "fulfillmentText": "Your ticket number: " + req.body.queryResult.parameters.ticket_number + " is updated successfully with status " + newstatus }));
				} */
            });
            break;
		/**create leave in lob */
        case "createleave":
            var emp = new leaveModel();
            emp.name = "Amrita";
            emp.leave_type = (req.body.queryResult.parameters.leavetype).toString();
            emp.start_date = (req.body.queryResult.parameters.startdate).toString();
            emp.end_date = (req.body.queryResult.parameters.enddate).toString();
            emp.desc = (req.body.queryResult.parameters.leavedes).toString();
			emp.cur_date = currentTime;
			emp.empid = 156539;
            emp.leave_status = "Pending";
            emp.save();
            console.log("Your leave has been successfully.Leave type is " + emp.leave_type + " and starting date: " + emp.start_date);
            response.send(JSON.stringify({ "fulfillmentText": "Your leave has been created successfully. Leave type is " + emp.leave_type + " and starting date: " + emp.start_date}));
            break;
		/**search leave in lob */
        case "searchleave":
            var start_date = req.body.queryResult.parameters.startdate.toString();
            leaveModel.find({ "start_date": start_date }, function (err, data) {
                if (err) { return handleError(res, err); }
                console.log("search data", data);
                console.log(data[0].name);
                response.send(JSON.stringify({ "fulfillmentText": "Employee name: " + data[0].name + " leave start date is: " + data[0].start_date + " and Status is " + data[0].leave_status }));
            });
            break;
		/**search leave list for pending status in lob */
        case "pendingemployeelist":
           leaveModel.find({ "leave_status": "Pending" }, function (err, data) {
                response.setHeader('Content-Type', 'application/json');
                if (err) { return handleError(res, err); }
                var result;
                data.forEach(function (element) {
                    result += "Employee id: " + element.empid + " and start date : " + element.start_date + " Status is " + element.leave_status + '\n';
                });
				 var resultstring = result.substring(9);
                response.send(JSON.stringify({ "fulfillmentText": resultstring }));               
            });
            break;
		/**update leave in lob */
         case "apporveleave":
            var myquery = { empid: req.body.queryResult.parameters.empid, start_date: req.body.queryResult.parameters.startdate };
            var newvalues = { $set: { leave_status: "Approved" } };
            leaveModel.updateOne(myquery, newvalues, function (err, data) {
                if (err) throw err;
                console.log("1 document updated", data);
                response.send(JSON.stringify({ "fulfillmentText": "Employee id:" + req.body.queryResult.parameters.empid +"with start date "+req.body.queryResult.parameters.startdate+ " is apporved successfully." }));
            });
            break;
		/**Delete leave from lob using uniqueid */
			case "deleteleave":
            var myquery = { _id: req.body.queryResult.parameters.leaveid };
            leaveModel.remove(myquery, function (err, obj) {
                if (err) throw err;
                console.log(" document(s) deleted");
                response.send(JSON.stringify({ "fulfillmentText": "Deleted record successfully for Id " + req.body.queryResult.parameters.leaveid }));
            });
            break;
        }
    });   
});
/**Function to create resource group name*/
function createResourceGroup(resourceGroupName, callback) {
    var groupParameters = { location: location, tags: { sampletag: 'sampleValue' } };
    console.log('\n1.Creating resource group: ' + resourceGroupName);
    return resourceClient.resourceGroups.createOrUpdate(resourceGroupName, groupParameters, callback);
}
/**Function to create storage account name*/
function createStorageAccount(storageAccountName, resourceGroupName, callback) {
    console.log('\n2.Creating storage account: ' + storageAccountName);
    var createParameters = {
        location: location,
        sku: {
            name: accType,
        },
        kind: 'Storage',
        tags: {
            tag1: 'val1',
            tag2: 'val2'
        }
    };
    return storageClient.storageAccounts.create(resourceGroupName, storageAccountName, createParameters, callback);
}
/**Function to create virtual network*/
function createVnet(resourceGroupName, vnetName, subnetName, callback) {
    var vnetParameters = {
        location: location,
        addressSpace: {
            addressPrefixes: ['10.0.0.0/16']
        },
        dhcpOptions: {
            dnsServers: ['10.1.1.1', '10.1.2.4']
        },
        subnets: [{ name: subnetName, addressPrefix: '10.0.0.0/24' }],
    };
    console.log('\n3.Creating vnet: ' + vnetName);
    return networkClient.virtualNetworks.createOrUpdate(resourceGroupName, vnetName, vnetParameters, callback);
}
/**Function to create public Ip*/
function createPublicIP(resourceGroupName, publicIPName, callback) {
    var publicIPParameters = {
        location: location,
        publicIPAllocationMethod: 'Dynamic',
        dnsSettings: {
            domainNameLabel: domainNameLabel
        }
    };
    console.log('\n4.Creating public IP: ' + publicIPName);
    return networkClient.publicIPAddresses.createOrUpdate(resourceGroupName, publicIPName, publicIPParameters, callback);
}
/**Function to getting subnet info*/
function getSubnetInfo(resourceGroupName,vnetName,subnetName, callback) {
    console.log('\nGetting subnet info for: ' + subnetName);
    return networkClient.subnets.get(resourceGroupName, vnetName, subnetName, callback);
}
/**Function to find vmimage*/
function findVMImage(callback) {
    console.log(util.format('\nFinding a VM Image for location %s from ' +
        'publisher %s with offer %s and sku %s', location, publisher, offer, sku));
    return computeClient.virtualMachineImages.list(location, publisher, offer, sku, { top: 1 }, callback);
}
/**Function to create network interface*/
function createNIC(subnetInfo,publicIPInfo,networkInterfaceName,resourceGroupName, callback) {
    var nicParameters = {
        location: location,
        ipConfigurations: [
            {
                name: ipConfigName,
                privateIPAllocationMethod: 'Dynamic',
                subnet: subnetInfo,
                publicIPAddress: publicIPInfo
            }
        ]
    };
    console.log('\n5.Creating Network Interface: ' + networkInterfaceName);
    return networkClient.networkInterfaces.createOrUpdate(resourceGroupName, networkInterfaceName, nicParameters, callback);
}
function createVirtualMachine(nicId,vmImageVersionNumber,resourceGroupName,vmName, storageAccountName,callback) {
    var vmParameters = {
        location: location,
        osProfile: {
            computerName: vmName,
            adminUsername: adminUsername,
            adminPassword: adminPassword
        },
        hardwareProfile: {
            vmSize: 'Basic_A0'
        },
        storageProfile: {
            imageReference: {
                publisher: publisher,
                offer: offer,
                sku: sku,
                version: vmImageVersionNumber
            },
            osDisk: {
                name: osDiskName,
                caching: 'None',
                createOption: 'fromImage',
                vhd: { uri: 'https://' + storageAccountName + '.blob.core.windows.net/nodejscontainer/osnodejslinux.vhd' }
            },
        },
        networkProfile: {
            networkInterfaces: [
                {
                    id: nicId,
                    primary: true
                }
            ]
        }
    };
    console.log('\n6.Creating Virtual Machine: ' + vmName);
    console.log('\n VM create parameters: ' + util.inspect(vmParameters, { depth: null }));
    computeClient.virtualMachines.createOrUpdate(resourceGroupName, vmName, vmParameters, callback);
}

/**Function to set env variabel*/
function _validateEnvironmentVariables() {
    var envs = [];
    if (!process.env['CLIENT_ID']) envs.push('CLIENT_ID');
    if (!process.env['DOMAIN']) envs.push('DOMAIN');
    if (!process.env['APPLICATION_SECRET']) envs.push('APPLICATION_SECRET');
    if (!process.env['AZURE_SUBSCRIPTION_ID']) envs.push('AZURE_SUBSCRIPTION_ID');
    if (envs.length > 0) {
        throw new Error(util.format('please set/export the following environment variables: %s', envs.toString()));
    }
}

function _generateRandomId(prefix, exsitIds) {
    var newNumber;
    while (true) {
        newNumber = prefix + Math.floor(Math.random() * 10000);
        if (!exsitIds || !(newNumber in exsitIds)) {
            break;
        }
    }
    return newNumber;
}