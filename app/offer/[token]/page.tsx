import { getPublicOffer } from "@/app/actions/offers";
import { OfferView } from "@/app/components/offer-view";

export const metadata = { title: "Your offer" };

export default async function OfferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const offer = await getPublicOffer(token);
  return (
    <main className="min-h-screen bg-[#0a0a0f] px-4 py-6 text-dark-text sm:px-8">
      <div className="mx-auto max-w-3xl">
        {offer ? <OfferView token={token} offer={offer} /> : (
          <div className="card-glass mt-16 rounded-2xl p-8 text-center">
            <h1 className="font-display text-[22px]">This offer link isn&apos;t valid</h1>
            <p className="mt-2 text-[14px] text-dark-text-secondary">Reply to the email you received and the team will help.</p>
          </div>
        )}
      </div>
    </main>
  );
}
