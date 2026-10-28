import { expect, test } from '@playwright/test'; // Browser ke saath asli user jaise test karne ke helpers lete hain.

// Anonymous filing aur receipt copy ka poora browser flow check karte hain.
test('anonymous petitioner files a petition and copies the receipt', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']); // Browser ko test ke liye copy-paste ki ijazat dete hain.
  await page.goto('/intake?mode=anonymous'); // Seedha anonymous filing form kholte hain.
  await page.getByPlaceholder('e.g. Unsanitary food conditions in Girls Hostel 3 Mess').fill('Day six sample hostel concern'); // Complaint ka chhota naam bharte hain.
  await page.getByPlaceholder('Provide specific details, dates, affected students, and attempts made to contact authorities...').fill('This test checks that an anonymous petition receives a real server receipt.'); // Complaint ka zaruri bayan bharte hain.
  await page.getByRole('button', { name: /Submit Anonymous Petition/ }).click(); // Anonymous petition server ko bhejne ka button dabate hain.
  await expect(page.getByRole('heading', { name: 'Save Your Anonymous Receipt Secret' })).toBeVisible(); // Receipt wala popup aa gaya ho to dekhte hain.
  await expect(page.getByText('b'.repeat(64))).toBeVisible(); // Server se aaya asli test receipt code dikh raha hai.
  await page.getByRole('button', { name: 'Copy' }).click(); // Receipt code clipboard mein copy karwate hain.
  await expect(page.getByText('Copied')).toBeVisible(); // Page copy ka jawab dikhata hai.
});

// Officer login, internal note aur resolution ka poora browser flow check karte hain.
test('officer reviews a case, adds an internal note, and resolves it', async ({ page }) => {
  await page.goto('/auth/login'); // Login screen kholte hain.
  await page.getByRole('button', { name: 'Departmental Portal' }).click(); // Officer login wala tab chunte hain.
  await page.getByPlaceholder('officer@institution.edu').fill('officer@example.edu'); // Test officer ka email bharte hain.
  await page.getByPlaceholder('••••••••').fill('test-password'); // Test password bharte hain.
  await page.getByRole('button', { name: 'Sign In as Official' }).click(); // Officer ke roop mein andar jaate hain.
  await expect(page.getByRole('heading', { name: 'Officer triage queue' })).toBeVisible(); // Officer ka kaam wala page khulne ka intezar karte hain.
  await page.getByRole('button', { name: 'Manage case' }).click(); // Sample case ka action drawer kholte hain.
  await page.getByPlaceholder('Write an internal note for the team…').fill('Checked the submitted record with the department.'); // Team ke liye private note likhte hain.
  await page.getByRole('button', { name: 'Add internal note' }).click(); // Private note save karwate hain.
  await expect(page.getByText('Checked the submitted record with the department.')).toBeVisible(); // Note discussion mein aa gaya ho to dekhte hain.
  await page.getByPlaceholder('Resolution note, at least 10 characters').fill('The department corrected the record and informed the petitioner.'); // Case solve karne ki wajah likhte hain.
  await page.getByRole('button', { name: 'Resolve with note' }).click(); // Note ke saath case resolved karte hain.
  await expect(page.getByRole('status').filter({ hasText: 'Status update saved to the audit ledger.' })).toBeVisible(); // Page server ki safalta dikhata hai.
});

// Public numbers, mobile layout aur browser record-checker ka flow check karte hain.
test('public ledger fits a phone screen and verifies a ticket chain', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); // Phone jaise chhote screen ka size rakhte hain.
  await page.goto('/transparency'); // Public numbers wala page kholte hain.
  await expect(page.getByRole('heading', { name: 'Institution-wide redressal, in the open' })).toBeVisible(); // Public page ka heading dekhte hain.
  await expect(page.getByText('Petitions filed')).toBeVisible(); // Public ginti ka card aaya ho to dekhte hain.
  await expect(page.getByText('Mess food quality')).toBeVisible(); // Sample AI theme dikh raha ho to dekhte hain.
  const pageFitsPhone = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth); // Dekhte hain page phone se zyada chaurha to nahi.
  expect(pageFitsPhone).toBe(true); // Phone par side mein anchaaha scroll na ho.
  await page.getByRole('button', { name: 'Open record checker' }).click(); // Record check karne ka popup kholte hain.
  await page.getByLabel('Ticket ID').fill('11111111-1111-4111-8111-111111111111'); // Test ticket ka code likhte hain.
  await page.getByRole('button', { name: 'Verify record' }).click(); // Browser se record seal check karwate hain.
  await expect(page.getByText(/Chain intact/)).toBeVisible(); // Sahi test chain ki tasdeeq dekhte hain.
});
