import { LightningElement, track } from 'lwc';
import getLeadByEmail from "@salesforce/apex/leadController.getLeadByEmail"
import getContactByEmail from "@salesforce/apex/contactController.getContactByEmail"
import { createRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import ACCOUNT_OBJECT from '@salesforce/schema/Account';
import NAME_FIELD from '@salesforce/schema/Account.Name';
import MOGLISMS_OBJECT from '@salesforce/schema/Mogli_SMS__SMS__c';
import MOGLISMSATTACHMENTS_FIELD from '@salesforce/schema/Mogli_SMS__SMS__c.Mogli_SMS__Attachments__c';
import MOGLISMSDIRECTION_FIELD from '@salesforce/schema/Mogli_SMS__SMS__c.Mogli_SMS__Direction__c';
import MOGLISMSLEAD_FIELD from '@salesforce/schema/Mogli_SMS__SMS__c.Mogli_SMS__Lead__c';
import MOGLISMSCONTACT_FIELD from '@salesforce/schema/Mogli_SMS__SMS__c.Mogli_SMS__Contact__c';
import MOGLISMSMESSAGE_FIELD from '@salesforce/schema/Mogli_SMS__SMS__c.Mogli_SMS__Message__c';
import MOGLISMSOFFLINE_FIELD from '@salesforce/schema/Mogli_SMS__SMS__c.Mogli_SMS__Offline__c';
import MOGLISMSPHONENUMBER_FIELD from '@salesforce/schema/Mogli_SMS__SMS__c.Mogli_SMS__Phone_Number__c';
import MOGLISMSSCHEDULED_FIELD from '@salesforce/schema/Mogli_SMS__SMS__c.Mogli_SMS__Scheduled_Delivery__c';
import MOGLISMSSTATUS_FIELD from '@salesforce/schema/Mogli_SMS__SMS__c.Mogli_SMS__Status__c';
import MOGLISMSISBATCH_FIELD from '@salesforce/schema/Mogli_SMS__SMS__c.Mogli_SMS__isBatchTransaction__c';

export default class StpoGTWSMSNotification extends LightningElement {
    @track webinarId
    @track message
    @track totalOfSMSSent = 0
    disabled = false;

    sendNotification(){
        /** validate inputs */
        const allValid = [
            ...this.template.querySelectorAll(".inp"),
        ].reduce((validSoFar, inputCmp) => {
            inputCmp.reportValidity();
            return validSoFar && inputCmp.checkValidity();
        }, true);
        if (allValid) {
            this.disabled = true
            var inputs=this.template.querySelectorAll(".inp")
            inputs.forEach(function(element){
                if(element.name=="webinarID")
                    this.webinarId=element.value;
    
                else if(element.name=="message")
                    this.message=element.value;
            },this)
            /** Call GTW API and get access token */
            const latestToken = "eyJraWQiOiJvYXV0aHYyLmxtaS5jb20uMDIxOSIsImFsZyI6IlJTNTEyIn0.eyJzYyI6ImNvbGxhYjoiLCJzdWIiOiIzMDAwMDAwMDAwMDAzNzU0NjAiLCJhdWQiOiIyZWVhN2EwOS01MDBlLTQyNzgtOTk0Yi04YWIyM2UyYzg0YTgiLCJvZ24iOiJwd2QiLCJ0eXAiOiJyIiwiZXhwIjoxNjYxNTQwNTgyLCJpYXQiOjE2NTg5NDg1ODIsImp0aSI6ImEzOWQ5NTEwLTU1NGYtNGNhYS1hNzViLTZhNjRmZGE0YzA5MiJ9.J1tqWPDp8UvyqUj7Lus6HiYM8omos55oc3SSSGotTWmvrMCNQEvVB-XurPHeuCV28Ea5UfoO8kzH8re1VKKTRU9AIILGyhS3d-RsGlaKFaVTt1y4kw2EqdGGy0b2M0RITjJxCRpDFTC9TvelTZUHATzP6_Fc-ysbI0QV7JK86NollhRY5MGY7VFzUJg6Dn_wzLaFoayuXA7BLcb9SU7oLfyzMjDNfTF3o6mdx6x7zUvmN8Vn1JZRo2vsltYI--3K1bU-CS975JW2_uP02fGjXbrzVgA4J_8HmR1-cgmE-fj3IJ3PlS6TngzDTlx-9g616C8SBNMJOS-lcqqcAGgDXw"
            this.postData(`https://api.getgo.com/oauth/v2/token?grant_type=refresh_token&refresh_token=${latestToken}`)
            .then(data => {
                if(data?.access_token) {
                    /** Call GTW API and read webinar registrants */
                    this.readWebinarRegistrants(this.webinarId, data.access_token)
                } else {
                    this.disabled = false
                }
              })
            .catch(error => {
                console.log("TOKEN ERROR", error)
            });
        }
    }

    async readWebinarRegistrants(webinarId, accesstoken) {
        let data
        try {
            data = await this.getData("https://api.getgo.com/G2W/rest/v2/organizers/300000000000375460/webinars/" + webinarId + "/registrants", accesstoken)
        }
        catch(error) {
            console.log(`⛔Can't get webinar Data: `, error)
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: `Can't get Webinar data from GTW. More info logged to the console.`,
                    variant: 'error',
                }),
            );
        }
        if(data.length > 0){
            console.log('CREATE MOGLI RECORDS')
            /** Create Mogli SMS Record in Salesforce for each registrant */
            await this.createMogliSMSRecords(data)
        }
    }

    checkProcessedRecordsCount() {
        itemsProcessed++;
        if(itemsProcessed === registrants.length) {
            this.disabled = false
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Success',
                    message: 'SMS notification was sent to ' + this.totalOfSMSSent + ' registrants',
                    variant: 'success',
                }),
            );
        }
    }

    async createMogliSMSRecords(registrants) {
        var itemsProcessed = 0
        registrants.forEach(async registrant => {
            console.log('🧔 createMogliSMSRecords REGISTRANT: ', registrant)
            let isContact = true

            try {
                let lead = await getLeadByEmail({email: registrant.email})
                if(lead.length > 0) {
                    if(lead[0].Id && lead[0].Mogli_SMS__Mogli_Number__c) {
                        isContact = false
                        await this.createSMSRecord(registrant, lead[0])
                    }
                }
            } catch(error) {
                console.log('🧔 Problem with Lead record (registrant, contact, error): ', registrant, lead, error)
                this.checkProcessedRecordsCount()
            }

            if(isContact) {
                try {
                    let contact = await getContactByEmail({email: registrant.email})
                    if(contact.length > 0) {
                        if(contact[0].Id && contact[0].Mogli_SMS__Mogli_Number__c) {
                            await this.createSMSRecord(registrant, contact[0])
                        }
                    }
                } catch(error) {
                    console.log('⚠ Problem with Contact record (registrant, contact, error): ', registrant, contact, error)
                    this.checkProcessedRecordsCount()
                }
            }
            })
    }

    async createSMSRecord(registrant, data) {
        console.log('📧 Create SMS record for (registrant, data): ', registrant, data)
        this.totalOfSMSSent++;
        const dateNow = Date.now();
        const today = new Date(dateNow);
        const fields = {};

        fields[MOGLISMSATTACHMENTS_FIELD.fieldApiName] = false;
        fields[MOGLISMSDIRECTION_FIELD.fieldApiName] = "Outgoing";
        fields[MOGLISMSMESSAGE_FIELD.fieldApiName] = this.message + " " + registrant.joinUrl;
        fields[MOGLISMSOFFLINE_FIELD.fieldApiName] = false;
        fields[MOGLISMSPHONENUMBER_FIELD.fieldApiName] = data.Mogli_SMS__Mogli_Number__c;
        fields[MOGLISMSSCHEDULED_FIELD.fieldApiName] = today.toISOString();
        fields[MOGLISMSSTATUS_FIELD.fieldApiName] = "Queued";
        fields[MOGLISMSISBATCH_FIELD.fieldApiName] = false;

        // Create field depending if is Lead or Contact
        if(data.Id.startsWith('003')) {
            fields[MOGLISMSCONTACT_FIELD.fieldApiName] = data.Id;
        } else {
            fields[MOGLISMSLEAD_FIELD.fieldApiName] = data.Id;
        }
        

        const recordInput = { apiName: MOGLISMS_OBJECT.objectApiName, fields };
        console.log('   New Record: ', recordInput)

        // SEND SMS 
        await createRecord(recordInput)
        .then(record => {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Success',
                    message: 'Record created: ' + record.id,
                    variant: 'success',
                }),
            );
            console.log("SUCCESS", record)
        })
        .catch(error => {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error creating record',
                    message: error.body.message,
                    variant: 'error',
                }),
            );
            console.log("ERROR", error)
        });
    }
    
    async getData(url = '', token) {
        // Opciones por defecto estan marcadas con un *
        const response = await fetch(url, {
        method: 'GET',
        mode: 'cors', // no-cors, *cors, same-origin
        cache: 'no-cache',
        credentials: 'same-origin', // include, *same-origin, omit
        headers: {
            'Authorization':'Bearer ' + token,
            'Accept':'application/json'
        },
        redirect: 'follow', // manual, *follow, error
        referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
        })
        return response.json(); // parses JSON response into native JavaScript objects
    }
    
    async postData(url = '', data = {}) {
        // Opciones por defecto estan marcadas con un *
        const response = await fetch(url, {
        method: 'POST',
        mode: 'cors', // no-cors, *cors, same-origin
        cache: 'no-cache',
        credentials: 'same-origin', // include, *same-origin, omit
        headers: {
            'Authorization':'Basic MmVlYTdhMDktNTAwZS00Mjc4LTk5NGItOGFiMjNlMmM4NGE4Ok5hamxqcTNoTjc4aVk5MEVJYTRxU3Ixdg==',
            'Content-Type': 'application/x-www-form-urlencoded',
            // 'Accept':'application/json'
        },
        redirect: 'follow', // manual, *follow, error
        referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
        // body: JSON.stringify(data) // body data type must match "Content-Type" header
        });
        return response.json(); // parses JSON response into native JavaScript objects
    }
}
