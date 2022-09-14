public with sharing class leadController {
    @AuraEnabled(cacheable=true)
    public static List<Lead> getLeadByEmail(string email) {
        return [select Id, Mogli_SMS__Mogli_Number__c from Lead where Email LIKE:'%' + email + '%'];
    }
}
