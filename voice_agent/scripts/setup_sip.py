"""One-time LiveKit telephony setup for Neha.

Creates, in your LiveKit project:
  1. an outbound SIP trunk (Neha dials candidates through your Twilio Elastic SIP trunk),
  2. an inbound SIP trunk for your Twilio number,
  3. a dispatch rule that sends every inbound call to the Neha agent.

    python scripts/setup_sip.py \\
        --number +918035551234 \\
        --twilio-termination neha.pstn.twilio.com \\
        --username neha --password '...'

Prints the outbound trunk id: put it in the backend's LIVEKIT_SIP_TRUNK_ID.
In Twilio, point the Elastic SIP trunk's Origination URI at your LiveKit
SIP URI (Project settings → SIP URI) so inbound calls reach LiveKit.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os

from livekit import api


async def main(args: argparse.Namespace) -> None:
    lk = api.LiveKitAPI(
        os.environ["LIVEKIT_URL"], os.environ["LIVEKIT_API_KEY"], os.environ["LIVEKIT_API_SECRET"]
    )
    try:
        outbound = await lk.sip.create_sip_outbound_trunk(api.CreateSIPOutboundTrunkRequest(
            trunk=api.SIPOutboundTrunkInfo(
                name="neha-outbound",
                address=args.twilio_termination,
                numbers=[args.number],
                auth_username=args.username,
                auth_password=args.password,
            )
        ))
        print(f"Outbound trunk: {outbound.sip_trunk_id}   -> set LIVEKIT_SIP_TRUNK_ID")

        if args.no_inbound:
            return
        inbound = await lk.sip.create_sip_inbound_trunk(api.CreateSIPInboundTrunkRequest(
            trunk=api.SIPInboundTrunkInfo(
                name="neha-inbound",
                numbers=[args.number],
                krisp_enabled=True,
            )
        ))
        print(f"Inbound trunk:  {inbound.sip_trunk_id}")

        rule = await lk.sip.create_sip_dispatch_rule(api.CreateSIPDispatchRuleRequest(
            name="neha-inbound",
            trunk_ids=[inbound.sip_trunk_id],
            rule=api.SIPDispatchRule(
                dispatch_rule_individual=api.SIPDispatchRuleIndividual(room_prefix="inbound-"),
            ),
            room_config=api.RoomConfiguration(agents=[
                api.RoomAgentDispatch(
                    agent_name=args.agent_name,
                    metadata=json.dumps({"channel": "inbound"}),
                )
            ]),
        ))
        print(f"Dispatch rule:  {rule.sip_dispatch_rule_id}  (inbound calls -> agent '{args.agent_name}')")
    finally:
        await lk.aclose()


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--number", required=True, help="Your Twilio phone number, E.164")
    p.add_argument("--twilio-termination", required=True, help="Twilio Elastic SIP termination URI host")
    p.add_argument("--username", required=True, help="Credential list username on the Twilio trunk")
    p.add_argument("--password", required=True)
    p.add_argument("--agent-name", default=os.environ.get("LIVEKIT_AGENT_NAME", "neha"))
    p.add_argument("--no-inbound", action="store_true", help="Only create the outbound trunk")
    asyncio.run(main(p.parse_args()))
