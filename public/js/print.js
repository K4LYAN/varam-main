/* Print button on invoices / packing slips (kept external for the Content-Security-Policy) */
document.addEventListener("click", function (e) {
  if (e.target.closest("[data-print]")) window.print();
});
