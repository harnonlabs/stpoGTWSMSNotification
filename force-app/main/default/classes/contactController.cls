public with sharing class contactController {
    @AuraEnabled(cacheable=true)
    public static List<Contact> getContactByEmail(string email) {
        return [select Id, Mogli_SMS__Mogli_Number__c from Contact where Email LIKE:'%' + email + '%'];
    }
}
