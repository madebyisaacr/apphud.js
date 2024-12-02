document.addEventListener('DOMContentLoaded', async () => {
  await apphud.init({apiKey: "w2w_vAsN29VFXbA5iMVBWJn9kGG5Bq1dmtoUrSW", debug: true});

  // Setup track event button
  const eventButton = document.getElementById('track-event');
  eventButton.addEventListener('click', (e) => {
    e.preventDefault();

    apphud.track("answer", { answer: e.target.dataset.eventName })
  });

  // handle email save
  const emailBtn = document.getElementById('save-email-button');
  const emailInput = document.getElementById('email-input');
  emailBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    await apphud.setEmail(emailInput.value)
  });

  // When SDK initialized show form
  apphud.on("ready", () => {
    apphud.paymentForm()

    // if user have email - set it to input
    if (apphud.user.email) {
      emailInput.value = apphud.user.email
    }
  });

  // Get the container div and all buttons inside it
  const productsContainer = document.getElementById('products');
  const buttons = productsContainer.querySelectorAll('button');

  // Add click event listener to each button
  buttons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove the 'active' class from all buttons
      buttons.forEach(btn => btn.classList.remove('active'));

      // Add the 'active' class to the clicked button
      button.classList.add('active');

      setProduct(button)
    });
  });

  // save selected product
  function setProduct(product) {
    apphud.selectPlacementProduct(apphud.currentPlacement().identifier, product.dataset.productIndex)
    apphud.operateVariables()

    // we should reload form when product changed
    apphud.paymentForm()
  }
});
