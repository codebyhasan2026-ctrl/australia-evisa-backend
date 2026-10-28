async function testEmailJS() {
  const payload = {
    service_id: 'service_vylqt0p',
    template_id: 'template_m1le3h8',
    user_id: 'oKKj6gyzobPPFPDKY', // Correct Public Key (PPF not PFF)
    accessToken: 'iXUFOUiIvSjELWG-3IV8Q', // Correct Private Key (starts with lowercase i)
    template_params: {
      to_email: 'hasan.hmrj@gmail.com',
      subject: 'Official Verification Test - EmailJS Australia Work E-Visa',
      message_html: '<h2>EmailJS Connected Successfully!</h2><p>This email was sent via EmailJS through your Gmail account sendpulsesms@gmail.com to hasan.hmrj@gmail.com.</p>'
    }
  };

  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://australiaworkevisa.com'
      },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    console.log('EmailJS HTTP Status:', res.status, text);
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

testEmailJS();
