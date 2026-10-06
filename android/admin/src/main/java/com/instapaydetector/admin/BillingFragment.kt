package com.instapaydetector.admin

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Toast
import android.graphics.Paint
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.instapaydetector.admin.databinding.FragmentBillingBinding
import kotlinx.coroutines.launch
import org.json.JSONObject

class BillingFragment : Fragment() {

    private var _binding: FragmentBillingBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentBillingBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding.btnRefreshPlans.setOnClickListener { loadPlans() }
        loadPlans()
    }

    private fun loadPlans() {
        binding.btnRefreshPlans.text = "Loading…"
        binding.btnRefreshPlans.isEnabled = false

        lifecycleScope.launch {
            val response = ApiClient.get(requireContext(), "/api/admin/plans")
            binding.btnRefreshPlans.text = "Refresh Plans"
            binding.btnRefreshPlans.isEnabled = true

            if (response.isSuccessful && response.json != null) {
                val plans = response.json.optJSONArray("plans") ?: return@launch
                binding.plansContainer.removeAllViews()

                for (i in 0 until plans.length()) {
                    val plan = plans.getJSONObject(i)
                    val name = plan.optString("name", "Unknown")
                    val price = plan.optDouble("priceEgp", 0.0)
                    val maxTx = plan.optInt("maxTransactions", 0)
                    val periodDays = plan.optInt("periodDays", 30)
                    val offerActive = plan.optBoolean("hasActiveOffer", false)
                    val offerPrice = if (offerActive && !plan.isNull("offerPriceEgp")) plan.optDouble("offerPriceEgp") else null
                    val offerLabel = plan.optString("offerLabel", "Limited-time offer")
                    val offerEndsAt = if (plan.isNull("offerEndsAt")) null else plan.optString("offerEndsAt")

                    val itemView = LayoutInflater.from(requireContext())
                        .inflate(R.layout.item_plan_card, binding.plansContainer, false)

                    itemView.findViewById<android.widget.TextView>(R.id.tvPlanName).text =
                        name.replace("_", " ")
                    val priceView = itemView.findViewById<android.widget.TextView>(R.id.tvPlanPrice)
                    priceView.text = if (price <= 0) "Free" else "EGP %.2f / %dd".format(offerPrice ?: price, periodDays)
                    priceView.paintFlags = priceView.paintFlags and Paint.STRIKE_THRU_TEXT_FLAG.inv()
                    itemView.findViewById<android.widget.TextView>(R.id.tvPlanLimit).text =
                        "$maxTx transactions"

                    itemView.findViewById<android.widget.TextView>(R.id.tvPlanOffer).apply {
                        if (offerPrice != null) {
                            val percent = (((price - offerPrice) / price) * 100).toInt()
                            text = "✨ $offerLabel · $percent% OFF · was EGP %.2f\nEnds ${offerEndsAt ?: "soon"}".format(price)
                            visibility = View.VISIBLE
                        } else {
                            visibility = View.GONE
                        }
                    }

                    itemView.findViewById<android.widget.ImageButton>(R.id.btnEditPlan)
                        .setOnClickListener {
                            showEditPlanDialog(name, price, maxTx, periodDays, offerPrice, offerLabel, offerEndsAt)
                        }

                    binding.plansContainer.addView(itemView)
                }
            } else if (response.isUnauthorized) {
                handleUnauthorized()
            } else {
                Toast.makeText(
                    requireContext(),
                    response.errorMessage ?: "Failed to load plans",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }

    private fun showEditPlanDialog(planName: String, currentPrice: Double, currentLimit: Int, currentPeriodDays: Int, currentOfferPrice: Double?, currentOfferLabel: String, offerEndsAt: String?) {
        val ctx = requireContext()
        val padding = (18 * resources.displayMetrics.density).toInt()
        val layout = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(padding, padding, padding, padding / 2)
            setBackgroundColor(ctx.getColor(R.color.bg_card))
        }

        val priceInput = EditText(ctx).apply {
            hint = "Price (EGP)"
            setText("%.0f".format(currentPrice))
            inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL
            textSize = 13f
            setTextColor(ctx.getColor(R.color.text_primary))
            setHintTextColor(ctx.getColor(R.color.text_tertiary))
            setBackgroundColor(ctx.getColor(R.color.bg_input))
            setPadding(padding / 2, padding / 2, padding / 2, padding / 2)
        }
        layout.addView(priceInput)

        val limitInput = EditText(ctx).apply {
            hint = "Max Transactions"
            setText("$currentLimit")
            inputType = android.text.InputType.TYPE_CLASS_NUMBER
            textSize = 13f
            setTextColor(ctx.getColor(R.color.text_primary))
            setHintTextColor(ctx.getColor(R.color.text_tertiary))
            setBackgroundColor(ctx.getColor(R.color.bg_input))
            setPadding(padding / 2, padding / 2, padding / 2, padding / 2)
        }
        layout.addView(limitInput)

        val periodInput = EditText(ctx).apply {
            hint = "Plan duration (days)"
            setText("$currentPeriodDays")
            inputType = android.text.InputType.TYPE_CLASS_NUMBER
            textSize = 13f
            setTextColor(ctx.getColor(R.color.text_primary))
            setHintTextColor(ctx.getColor(R.color.text_tertiary))
            setBackgroundColor(ctx.getColor(R.color.bg_input))
            setPadding(padding / 2, padding / 2, padding / 2, padding / 2)
        }
        layout.addView(periodInput)

        val supportsOffers = currentPrice > 0 && planName != "ENTERPRISE"
        val offerPriceInput = EditText(ctx).apply {
            hint = "Offer price (empty removes offer)"
            setText(currentOfferPrice?.let { "%.2f".format(it) } ?: "")
            inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL
            textSize = 13f
            setTextColor(ctx.getColor(R.color.text_primary))
            setHintTextColor(ctx.getColor(R.color.text_tertiary))
            setBackgroundColor(ctx.getColor(R.color.accent_violet_bg))
            setPadding(padding / 2, padding / 2, padding / 2, padding / 2)
        }
        val offerLabelInput = EditText(ctx).apply {
            hint = "Offer label"
            setText(currentOfferLabel.ifBlank { "Limited-time offer" })
            textSize = 13f
            setTextColor(ctx.getColor(R.color.text_primary))
            setHintTextColor(ctx.getColor(R.color.text_tertiary))
            setBackgroundColor(ctx.getColor(R.color.bg_input))
            setPadding(padding / 2, padding / 2, padding / 2, padding / 2)
        }
        val remainingDays = offerEndsAt?.let {
            runCatching {
                val end = java.time.Instant.parse(it).toEpochMilli()
                kotlin.math.ceil((end - System.currentTimeMillis()).coerceAtLeast(86_400_000L) / 86_400_000.0).toInt()
            }.getOrNull()
        } ?: 7
        val offerDaysInput = EditText(ctx).apply {
            hint = "Offer valid for days"
            setText("$remainingDays")
            inputType = android.text.InputType.TYPE_CLASS_NUMBER
            textSize = 13f
            setTextColor(ctx.getColor(R.color.text_primary))
            setHintTextColor(ctx.getColor(R.color.text_tertiary))
            setBackgroundColor(ctx.getColor(R.color.bg_input))
            setPadding(padding / 2, padding / 2, padding / 2, padding / 2)
        }
        if (supportsOffers) {
            layout.addView(offerPriceInput)
            layout.addView(offerLabelInput)
            layout.addView(offerDaysInput)
        }

        AlertDialog.Builder(ctx)
            .setTitle("Edit Plan: ${planName.replace("_", " ")}")
            .setView(layout)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Save") { _, _ ->
                val newPrice = priceInput.text.toString().toDoubleOrNull() ?: currentPrice
                val newLimit = limitInput.text.toString().toIntOrNull() ?: currentLimit
                val newPeriod = periodInput.text.toString().toIntOrNull() ?: currentPeriodDays
                val newOfferPrice = if (supportsOffers) offerPriceInput.text.toString().toDoubleOrNull() else null
                val newOfferLabel = offerLabelInput.text.toString().trim().ifBlank { "Limited-time offer" }
                val offerValidDays = offerDaysInput.text.toString().toIntOrNull() ?: 7
                updatePlan(planName, newPrice, newLimit, newPeriod, newOfferPrice, newOfferLabel, offerValidDays, supportsOffers && newOfferPrice == null)
            }
            .show()
    }

    private fun updatePlan(planName: String, priceEgp: Double, maxTransactions: Int, periodDays: Int, offerPriceEgp: Double?, offerLabel: String, offerValidDays: Int, clearOffer: Boolean) {
        lifecycleScope.launch {
            val body = JSONObject().apply {
                put("name", planName)
                put("priceEgp", priceEgp)
                put("maxTransactions", maxTransactions)
                put("periodDays", periodDays)
                if (offerPriceEgp != null) {
                    put("offerPriceEgp", offerPriceEgp)
                    put("offerLabel", offerLabel)
                    put("offerValidDays", offerValidDays)
                } else if (clearOffer) {
                    put("clearOffer", true)
                }
            }
            val response = ApiClient.patch(requireContext(), "/api/admin/plans", body)
            if (response.isSuccessful) {
                Toast.makeText(requireContext(), "Plan updated", Toast.LENGTH_SHORT).show()
                loadPlans()
            } else if (response.isUnauthorized) {
                handleUnauthorized()
            } else {
                Toast.makeText(
                    requireContext(),
                    response.errorMessage ?: "Failed to update plan",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }

    private fun handleUnauthorized() {
        ApiClient.clearPrefs(requireContext())
        startActivity(android.content.Intent(requireActivity(), SetupActivity::class.java))
        requireActivity().finish()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
