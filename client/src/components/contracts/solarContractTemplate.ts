export const SOLAR_CONTRACT_TEMPLATE = `
<div style="text-align: center; margin-bottom: 0.8em;">
  <img src="/sps-logo.png" alt="Solar Power Store Canada" width="70px" style="max-height: 70px; width: auto; margin-bottom: 0.3em;" data-align="center" />
  <h1 style="font-size: 20pt; font-weight: 700; margin: 0;">SOLAR POWER STORE WORK CONTRACT</h1>
</div>

<hr style="border: none; border-top: 2px solid #333; margin: 0.8em 0;" />

<h2 style="font-size: 13pt; margin: 0.3em 0;">BETWEEN:</h2>

<p><strong>Contractor:</strong><br/>
Solar Power Store Canada Ltd.<br/>
526 Bryne Dr, Unit C, Barrie, ON L4N 9P6<br/>
Phone: 1-888-421-5354<br/>
Email: projects@solarpowerstore.ca</p>

<p style="text-align: center; font-weight: 600; font-size: 12pt; margin: 0.6em 0;">AND</p>

<p><strong>Client:</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 0.8em;">
  <tbody>
    <tr>
      <td style="width: 100px; padding: 4px 8px; border: 1px solid #bbb; font-weight: 600; background: #f9f9f9;">Name:</td>
      <td style="padding: 4px 8px; border: 1px solid #bbb;"><span class="merge-field" data-merge-field="{{client_name}}">{{client_name}}</span></td>
    </tr>
    <tr>
      <td style="padding: 4px 8px; border: 1px solid #bbb; font-weight: 600; background: #f9f9f9;">Address:</td>
      <td style="padding: 4px 8px; border: 1px solid #bbb;"><span class="merge-field" data-merge-field="{{project_address}}">{{project_address}}</span></td>
    </tr>
    <tr>
      <td style="padding: 4px 8px; border: 1px solid #bbb; font-weight: 600; background: #f9f9f9;">Phone:</td>
      <td style="padding: 4px 8px; border: 1px solid #bbb;"><span class="merge-field" data-merge-field="{{client_phone}}">{{client_phone}}</span></td>
    </tr>
    <tr>
      <td style="padding: 4px 8px; border: 1px solid #bbb; font-weight: 600; background: #f9f9f9;">Email:</td>
      <td style="padding: 4px 8px; border: 1px solid #bbb;"><span class="merge-field" data-merge-field="{{client_email}}">{{client_email}}</span></td>
    </tr>
  </tbody>
</table>

<hr style="border: none; border-top: 2px solid #333; margin: 0.8em 0;" />

<h2 style="font-size: 13pt; margin: 0.3em 0;">PROJECT NAME</h2>
<p><span class="merge-field" data-merge-field="{{project_name}}">{{project_name}}</span></p>

<h2 style="font-size: 13pt; margin: 0.5em 0 0.3em 0;">SITE PLAN</h2>
<p style="background: #f0f7ff; border: 1px dashed #4a90d9; padding: 0.6em; text-align: center; color: #4a90d9; font-style: italic; font-size: 10pt;">
Site plan will be attached during contract generation (supports PDF or image files)
</p>

<h2 style="font-size: 13pt; margin: 0.5em 0 0.3em 0;">LATEST PROPOSAL</h2>
<p style="background: #f0f7ff; border: 1px dashed #4a90d9; padding: 0.6em; text-align: center; color: #4a90d9; font-style: italic; font-size: 10pt;">
Latest proposal will be attached during contract generation (supports PDF or image files)
</p>

<h2 style="font-size: 13pt; margin: 0.5em 0 0.3em 0;">PROJECT DESCRIPTION</h2>
<p><span class="merge-field" data-merge-field="{{project_description}}">{{project_description}}</span></p>

<hr style="border: none; border-top: 2px solid #333; margin: 0.8em 0;" />

<h2 style="font-size: 13pt; margin: 0.3em 0;">CONTRACT PRICE</h2>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 0.5em;">
  <tbody>
    <tr>
      <td style="padding: 5px 8px; border: 1px solid #bbb; width: 70%;">Subtotal (before HST):</td>
      <td style="padding: 5px 8px; border: 1px solid #bbb; text-align: right; font-weight: 500;">$<span class="merge-field" data-merge-field="{{subtotal}}">{{subtotal}}</span></td>
    </tr>
    <tr>
      <td style="padding: 5px 8px; border: 1px solid #bbb;">HST (<span class="merge-field" data-merge-field="{{hst_rate}}">{{hst_rate}}</span>):</td>
      <td style="padding: 5px 8px; border: 1px solid #bbb; text-align: right; font-weight: 500;">$<span class="merge-field" data-merge-field="{{hst_amount}}">{{hst_amount}}</span></td>
    </tr>
    <tr style="background: #f5f5f5;">
      <td style="padding: 5px 8px; border: 1px solid #bbb; font-weight: 700;">Total Contract Price (including tax):</td>
      <td style="padding: 5px 8px; border: 1px solid #bbb; text-align: right; font-weight: 700;">$<span class="merge-field" data-merge-field="{{total_price}}">{{total_price}}</span></td>
    </tr>
  </tbody>
</table>

<hr style="border: none; border-top: 2px solid #333; margin: 0.8em 0;" />

<h2 style="font-size: 13pt; margin: 0.3em 0;">PAYMENT SCHEDULE</h2>
<span class="merge-field" data-merge-field="{{payment_schedule}}">{{payment_schedule}}</span>
<p style="font-size: 9pt; color: #888; font-style: italic; margin-top: 0.3em;">Total Payments must equal the Total Contract Price listed above.</p>

<hr style="border: none; border-top: 2px solid #333; margin: 0.8em 0;" />

<h2 style="font-size: 13pt; margin: 0.3em 0;">PAYMENT METHOD</h2>
<p>Payments can be made by:</p>
<ul>
  <li>Direct bank transfer</li>
  <li>Credit card</li>
  <li>ACH (secure payment link provided upon request)</li>
  <li>Financing (if applicable)</li>
</ul>
<p><strong>Payment Method:</strong> <span class="merge-field" data-merge-field="{{payment_method}}">{{payment_method}}</span></p>
<p><strong>Invoice / Payment Link:</strong> <span class="merge-field" data-merge-field="{{helcim_link}}">{{helcim_link}}</span></p>

<div style="page-break-before: always;"></div>

<div style="text-align: center; margin-bottom: 0.5em; padding-bottom: 0.3em; border-bottom: 1px solid #ddd;">
  <img src="/sps-logo.png" alt="Solar Power Store Canada" width="40px" style="max-height: 40px; width: auto;" data-align="center" />
</div>

<h2 style="font-size: 13pt; margin: 0.3em 0;">APPENDIX A: TERMS AND CONDITIONS</h2>

<p style="font-size: 10pt;"><strong>1. Contract Work.</strong> The "Work" consists of the work described in Appendix B: Scope of Work (the "Work") to be performed by Solar Power Store Canada Ltd. (the "Contractor") in respect of the Project.</p>

<p style="font-size: 10pt;"><strong>2. Contract.</strong> The "Contract" between the Client and Contractor consists of the Solar Power Store Canada Ltd. General Terms and Conditions (including appendices), and any drawings, specifications, and tender documents (including addenda) referenced therein (collectively, the "Contract Documents"). The Contract constitutes the entire agreement between the parties with respect to the Work.</p>

<p style="font-size: 10pt;"><strong>3. Invoicing and Payment.</strong> The Client shall make payments in accordance with the Price and Payment Schedule. Late payments shall be subject to a 5% monthly late fee. The Contractor may charge any payment method on record for unpaid amounts overdue by 72 hours or more.</p>

<p style="font-size: 10pt;"><strong>4. Changes.</strong> If the Client requests changes to the Work or Project, the Contractor may advise that a price or schedule adjustment is required. The Client must sign a change order before proceeding. The Contractor is not obligated to perform any change without a signed change order.</p>

<p style="font-size: 10pt;"><strong>5. Default.</strong> If the Client fails to pay within 7 days, becomes insolvent, or fails to comply with the Contract, the Contractor may deem all amounts due immediately payable and suspend or terminate work. The Contractor may also recover lost profits and any related costs.</p>

<p style="font-size: 10pt;"><strong>6. Client's Obligations.</strong> The Client shall furnish site information, provide access, obtain necessary permits, and ensure the site is ready for installation. The Client is responsible for ensuring no interference from other contractors or individuals during the Work.</p>

<p style="font-size: 10pt;"><strong>7. Other Contractors.</strong> If the Client engages other contractors, the Contractor shall not be responsible for coordinating or supervising their work. Any delays or damages caused by others will result in additional costs or schedule extensions.</p>

<p style="font-size: 10pt;"><strong>8. Limitation of Liability.</strong> The Contractor's total liability shall not exceed 50% of the labour portion of the Contract Price. The Contractor shall not be liable for indirect, consequential, incidental, or special damages, including loss of profits or business interruption.</p>

<p style="font-size: 10pt;"><strong>9. Waiver.</strong> Upon final payment, the Client releases the Contractor from all claims relating to the Project or Work.</p>

<p style="font-size: 10pt;"><strong>10. Schedule and Title.</strong> Completion dates are estimates only. Title to all Work remains with the Contractor until full payment is made.</p>

<p style="font-size: 10pt;"><strong>11. Delay.</strong> If delays are caused by the Client or external factors beyond the Contractor's control, reasonable extensions and cost adjustments shall apply.</p>

<p style="font-size: 10pt;"><strong>12. Warranty.</strong> The Contractor provides a 10-year warranty for labour and workmanship.</p>

<p style="font-size: 10pt;"><strong>13. General.</strong> This Contract is governed by the laws of the province of <span class="merge-field" data-merge-field="{{province}}">{{province}}</span>. The Contractor may photograph the Work for marketing purposes. The parties are independent contractors. Invalid clauses shall not affect the remainder of the Contract.</p>

<p style="text-align: right; margin-top: 1.5em; font-style: italic;">
Client Initials: <span class="merge-field" data-merge-field="{{client_initials}}">{{client_initials}}</span> ________
</p>

<div style="page-break-before: always;"></div>

<div style="text-align: center; margin-bottom: 0.5em; padding-bottom: 0.3em; border-bottom: 1px solid #ddd;">
  <img src="/sps-logo.png" alt="Solar Power Store Canada" width="40px" style="max-height: 40px; width: auto;" data-align="center" />
</div>

<h2 style="font-size: 13pt; margin: 0.3em 0;">APPENDIX B: SCOPE OF WORK</h2>

<span class="merge-field" data-merge-field="{{scope_of_work}}">{{scope_of_work}}</span>

<p style="text-align: right; font-style: italic; margin-top: 1.5em;">
Client Initials: <span class="merge-field" data-merge-field="{{client_initials}}">{{client_initials}}</span> ________
</p>

<div style="page-break-before: always;"></div>

<div style="text-align: center; margin-bottom: 0.5em; padding-bottom: 0.3em; border-bottom: 1px solid #ddd;">
  <img src="/sps-logo.png" alt="Solar Power Store Canada" width="40px" style="max-height: 40px; width: auto;" data-align="center" />
</div>

<h2 style="font-size: 13pt; margin: 0.3em 0;">SIGNATURES</h2>

<p>By signing below, both parties agree to the terms of this Contract, including all appendices.</p>

<table style="width: 100%; border-collapse: collapse; margin-top: 1.5em;">
  <tbody>
    <tr>
      <td style="width: 50%; padding: 8px; vertical-align: top; border: none;">
        <p><strong>Solar Power Store Canada Ltd.</strong></p>
        <p>Authorized Representative:</p>
        <div style="margin-top: 0.5em;"><span class="merge-field" data-merge-field="{{signature}}">{{signature}}</span></div>
        <p>Name: <span class="merge-field" data-merge-field="{{rep_name}}">{{rep_name}}</span></p>
        <p>Title: Project Manager</p>
        <p>Date: <span class="merge-field" data-merge-field="{{date}}">{{date}}</span></p>
      </td>
      <td style="width: 50%; padding: 8px; vertical-align: top; border: none;">
        <p><strong>Client</strong></p>
        <p>Signature:</p>
        <p style="margin-top: 1.5em; border-bottom: 1px solid #000; width: 90%; padding-bottom: 4px; color: #999; font-size: 9pt;">Pending client signature</p>
        <p>Name: <span class="merge-field" data-merge-field="{{client_name}}">{{client_name}}</span></p>
        <p>Date: ______________________</p>
      </td>
    </tr>
  </tbody>
</table>
`.trim();
