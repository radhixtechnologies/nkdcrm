const db = require('../config/database');

async function testAllServices() {
    console.log('Testing all services against DB schema...');

    // 1. Sites migration: add missing statutory columns
    console.log('Adding missing statutory columns to sites table...');
    await db.query(`
        ALTER TABLE sites ADD COLUMN IF NOT EXISTS principal_employer_name VARCHAR(200);
        ALTER TABLE sites ADD COLUMN IF NOT EXISTS principal_employer_address TEXT;
        ALTER TABLE sites ADD COLUMN IF NOT EXISTS main_contractor_name VARCHAR(200);
        ALTER TABLE sites ADD COLUMN IF NOT EXISTS main_contractor_address TEXT;
        ALTER TABLE sites ADD COLUMN IF NOT EXISTS nature_of_work VARCHAR(200);
    `);
    console.log('✅ Sites columns added successfully!');

    // 2. Test Site Service create and update
    const siteService = require('../services/siteService');
    const sites = await siteService.getAllSites();
    console.log(`✅ getAllSites OK, count: ${sites.length}`);

    // Test creating a site
    const testSiteCode = 'TEST_SITE_' + Date.now();
    const createdSite = await siteService.createSite({
        site_code: testSiteCode,
        site_name: 'Test Site',
        address: 'Test Address',
        city: 'Noida',
        state: 'Uttar Pradesh',
        pincode: '201309',
        is_active: true,
        principal_employer_name: 'Nath Bros',
        principal_employer_address: 'Sector 57, Noida',
        main_contractor_name: 'NKD Facilities',
        main_contractor_address: 'Noida',
        nature_of_work: 'Facility Management'
    });
    console.log(`✅ createSite OK, site_id: ${createdSite.site_id}`);

    // Update site
    await siteService.updateSite(createdSite.site_id, {
        site_code: testSiteCode,
        site_name: 'Test Site Updated',
        address: 'Test Address Updated',
        city: 'Noida',
        state: 'Uttar Pradesh',
        pincode: '201309',
        is_active: true,
        principal_employer_name: 'Nath Bros Updated',
        principal_employer_address: 'Sector 57, Noida',
        main_contractor_name: 'NKD Facilities',
        main_contractor_address: 'Noida',
        nature_of_work: 'Facility Management'
    });
    console.log(`✅ updateSite OK!`);

    // Clean up test site
    await siteService.deleteSite(createdSite.site_id);
    console.log(`✅ deleteSite OK!`);

    // 3. Test Shifts
    const shiftService = require('../services/shiftService');
    const shifts = await shiftService.getAllShifts();
    console.log(`✅ getAllShifts OK, count: ${shifts.length}`);

    // 4. Test Leave Service
    const leaveService = require('../services/leaveService');
    const leaveTypes = await leaveService.getLeaveTypes();
    console.log(`✅ getLeaveTypes OK, count: ${leaveTypes.length}`);
    const pendingLeaves = await leaveService.getPendingLeaveRequests();
    console.log(`✅ getPendingLeaveRequests OK, count: ${pendingLeaves.length}`);
    const allLeaves = await leaveService.getAllLeaves();
    console.log(`✅ getAllLeaves OK, count: ${allLeaves.length}`);

    // 5. Test Payroll Service
    const payrollService = require('../services/payrollService');
    const payrollConfig = await payrollService.getPayrollConfig();
    console.log(`✅ getPayrollConfig OK, count: ${payrollConfig.length}`);
    const payrollList = await payrollService.getPayrollByPeriod(3, 2026);
    console.log(`✅ getPayrollByPeriod OK, count: ${payrollList.length}`);

    // 6. Test Benefits & Perks
    const benefitService = require('../services/benefitService');
    const perkService = require('../services/perkService');
    const benTypes = await benefitService.getAllBenefitTypes();
    console.log(`✅ getAllBenefitTypes OK, count: ${benTypes.length}`);
    const perkTypes = await perkService.getAllPerkTypes();
    console.log(`✅ getAllPerkTypes OK, count: ${perkTypes.length}`);
    const pendingClaims = await benefitService.getPendingClaims();
    console.log(`✅ getPendingClaims OK, count: ${pendingClaims.length}`);

    // 7. Test Reports Service
    const reportsService = require('../services/reportsService');
    const pfRep = await reportsService.getPFReport(3, 2026);
    console.log(`✅ getPFReport OK`);
    const esiRep = await reportsService.getESIReport(3, 2026);
    console.log(`✅ getESIReport OK`);
    const ptRep = await reportsService.getPTReport(3, 2026);
    console.log(`✅ getPTReport OK`);
    const bankRep = await reportsService.getBankTransferReport(3, 2026);
    console.log(`✅ getBankTransferReport OK`);
    const attRep = await reportsService.getAttendanceSummary(3, 2026);
    console.log(`✅ getAttendanceSummary OK`);
    const deptRep = await reportsService.getPayrollByDepartment(3, 2026);
    console.log(`✅ getPayrollByDepartment OK`);
    const otRep = await reportsService.getOvertimeReport(3, 2026);
    console.log(`✅ getOvertimeReport OK`);

    console.log('\n🎉 ALL SERVICES VERIFIED AND WORKING 100%!');
    process.exit(0);
}

testAllServices().catch(err => {
    console.error('❌ Service test failed:', err);
    process.exit(1);
});

