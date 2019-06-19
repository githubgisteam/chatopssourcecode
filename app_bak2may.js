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

/**pass incoming webhook to send messege to slack */
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


///////////////////////////////////////////
//     Entrypoint for sample script      //
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
					text:  'Power off virtual machine name '+vmName
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
						text:  'Start virtual machine name '+vmName
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